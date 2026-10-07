## Context

El rol de moderador está representado dos veces en DynamoDB:

- `ROOM#<id> / META.moderatorName` — la fuente de autorización. Todas las acciones de moderación comparan el nombre de la conexión contra este campo (p. ej. `reveal.ts`, `set-moderator-is-voter.ts`), y la web lo usa para decidir si mostrar los controles (`room.ts`, `isModerator`).
- `PARTICIPANT.isModerator` — lo usa la lista de participantes para dibujar el ícono y el control "el moderador vota" (`participant-list.html`).

Además `META.moderatorIsVoter` y `PARTICIPANT.isVoter` del moderador también están duplicados y `set-moderator-is-voter.ts` los actualiza juntos.

La desconexión se conoce solo vía `$disconnect`, que hoy hace `SET connected = false` sin marca de tiempo (Lambda en `handlers/disconnect.ts`, servidor local en `handleDisconnect` de `main.ts`). No hay ningún scheduler: nada "dispara" a los 60 segundos.

La web no tiene ningún mecanismo de avisos (toast/snackbar/`aria-live`), y la pantalla de sala no muestra los `error` que manda el servidor (`RoomClient.errorMessage$` existe pero `room.html` no lo consume).

## Goals / Non-Goals

**Goals:**
- Ceder y tomar la moderación de forma atómica: nunca puede quedar la sala con dos moderadores ni con `META` y participantes desincronizados.
- Validar la regla de los 60 segundos en el servidor, sin scheduler.
- Resolver la carrera de dos tomas simultáneas sin locks propios.
- Avisar al receptor de una cesión de forma accesible.

**Non-Goals:**
- Cerrar la herencia del rol por nombre (alguien que entra con el nombre de un moderador desconectado). Queda como hoy.
- Controles de ceder/tomar en la app mobile.
- Sucesión automática del rol sin acción de un participante.

## Decisions

### D1. Dos acciones nuevas en el protocolo

`transferModeration { roomId, targetName }` y `claimModeration { roomId }`, ambas por la ruta `$default`, ruteadas en `handlers/default.ts` y en `main.ts`. Ninguna devuelve un mensaje propio: el éxito se comunica con el `roomState` de siempre (broadcast con `maskRoomForViewer`) y el fallo con un `error` a la conexión que lo pidió.

*Alternativa descartada*: un único `changeModerator` con modo. Las precondiciones son distintas (quién puede pedirlo, qué se valida del moderador actual) y separarlas deja cada handler y su spec más simples.

### D2. Cambio de titular con `TransactWriteItems` condicional

Ambas acciones escriben en una sola transacción tres ítems:

| Ítem | Condición (transfer) | Condición (claim) | Escritura |
|---|---|---|---|
| `META` | `moderatorName = :caller` | `moderatorName = :currentMod` | `moderatorName = :new`, `moderatorIsVoter = true` |
| participante nuevo moderador | existe y `connected = true` | existe y `connected = true` | `isModerator = true`, `isVoter = true` |
| participante moderador anterior | — | `connected = false` y (`attribute_not_exists(disconnectedAt)` o `disconnectedAt <= :now - 60000`) | `isModerator = false`, `isVoter = true` |

La condición sobre `META.moderatorName` es la que resuelve la carrera de D3. El handler hace las validaciones baratas antes (la sala existe, quien llama está en la sala, `targetName ≠ caller`, en claim `caller ≠ moderatorName`) para devolver errores claros; la transacción re-valida todo atómicamente. Si falla con `TransactionCanceledException`, el handler responde `error` y no hace broadcast.

Votos, `roundPhase`, `currentStoryTitle` y `revealResult` no se tocan.

*Alternativa descartada*: tres `UpdateCommand` secuenciales (como hace hoy `set-moderator-is-voter.ts` con dos). Un fallo a mitad o una carrera dejaría dos íconos de moderador o un `META` que apunta a alguien sin `isModerator`.

*IAM*: `DynamoDBCrudPolicy` ya incluye `UpdateItem` y `ConditionCheckItem`, que son las acciones que autoriza una transacción. DynamoDB Local (stack local) también soporta transacciones.

### D3. "Gana el primero" = la condición sobre `META`

Dos `claimModeration` simultáneos leen el mismo `moderatorName` y arman la misma condición. DynamoDB serializa las transacciones sobre el mismo ítem: la primera cambia `moderatorName`, y la segunda falla la condición y recibe `error` ("La moderación ya fue tomada por otro participante"). No hace falta lock ni versión.

### D4. `disconnectedAt` en el participante

- `$disconnect` (Lambda y local) pasa a `SET connected = :false, disconnectedAt = :now`.
- `join-room.ts` ya hace `PutCommand` del ítem completo, así que el reingreso lo borra naturalmente al no incluirlo. Se deja explícito en el test.
- `Participant` en `shared-contracts` gana `disconnectedAt: number | null` (epoch ms), y `toParticipant` lo mapea.

**Participantes legacy** (desconectados antes del deploy, sin `disconnectedAt`): se tratan como desconectados hace más de 60 s — tanto en la condición del servidor (`attribute_not_exists`) como en el cliente (`!connected && disconnectedAt === null` habilita el botón). Lo peor que pasa es que se pueda tomar un poco antes, en salas que estaban vivas durante el deploy.

### D5. Botón "Tomar moderación" con reloj del cliente

Nada empuja un `roomState` a los 60 s, así que la web necesita un tick propio: un `signal` de "ahora" que se actualiza cada segundo solo mientras el moderador figura desconectado, y un `computed` `canClaim = !moderador.connected && (disconnectedAt === null || now - disconnectedAt >= 60_000) && !isModerator()`.

El reloj del cliente puede no coincidir con el del servidor. El servidor es la autoridad: si el botón aparece unos segundos antes y el servidor rechaza, el participante ve el error y puede reintentar. No se agrega sincronización de reloj.

*Alternativa descartada*: que el servidor mande `serverNow` en cada `roomState` para corregir el desfasaje. Agrega contrato para un caso que el servidor ya cubre.

### D6. Detección del aviso en el cliente

`room.ts` guarda el valor anterior de `isModerator()` y un flag `claimPending`:

- Al enviar `claimModeration`, `claimPending = true`.
- En cada cambio de `isModerator()`: si pasa de `false` a `true` y `claimPending` es `false` → mostrar aviso "Ahora sos el moderador". Si `claimPending` era `true`, no mostrar. En ambos casos `claimPending = false`.
- Si llega un `error` mientras `claimPending` es `true`, se limpia el flag.
- La primera carga de la sala (valor anterior desconocido) no cuenta como transición, para que un moderador que recarga no vea el aviso.

*Alternativa descartada*: un mensaje nuevo del servidor `moderationTransferred` dirigido al receptor. Duplica lo que el `roomState` ya informa, y en un reingreso tras cesión el mensaje se perdería igual.

### D7. Componente de aviso temporal en la web

Nuevo componente `ui/notice` (sin dependencias nuevas): contenedor con `role="status"` y `aria-live="polite"` siempre presente en el DOM (para que el lector de pantalla anuncie el cambio de contenido), texto del aviso, botón para cerrarlo, y cierre automático a los ~6 s. Se usa también para mostrar los rechazos de ceder/tomar, ya que hoy la sala no muestra los `error` del servidor.

### D8. UI de ceder y tomar

- "Hacer moderador": en `participant-list`, dentro de un menú de acciones por participante (botón ⋮, gris y sin borde, al final de la fila), solo junto a participantes conectados que no sean el moderador y solo si quien mira es el moderador (output `transferModeration(name)`). Sigue el patrón de botón de menú (`aria-haspopup`, `aria-expanded`, `role="menu"`/`menuitem`): el foco pasa a la opción al abrir, y se cierra con Escape (devolviendo el foco al ⋮) o con un clic afuera. Sin confirmación (decisión 6 del explore).
- Orden: la lista muestra al moderador vigente en la primera fila y al resto en el orden de siempre, para que tras un cambio de titular el nuevo moderador no quede perdido en el medio.
- "Tomar moderación": en `room.html`, en un aviso debajo de la lista ("El moderador está desconectado.") que ven todos menos el moderador mientras esté caído. Antes del plazo muestra "Si no vuelve en un minuto, vas a poder tomar la moderación."; cumplido el plazo, el botón.

*Ajustes durante la verificación manual*: (1) un botón con texto "Hacer moderador" en cada fila hacía demasiado ruido visual para una acción ocasional; se reemplazó por el menú ⋮. (2) El plan original ponía "Tomar moderación" junto al moderador en la lista, pero la fila de un participante desconectado se dibuja con opacidad 0.5 y el botón quedaba apagado, justo cuando es la acción principal.

### D9. Rechazos y errores repetidos

Los mensajes de error del servidor siguen en inglés, como el resto. La sala muestra su propio texto en español ("No se pudo tomar la moderación." / "No se pudo ceder la moderación.") según la acción pendiente, y solo si hay una pendiente: un error que llega sin haber pedido nada no se atribuye a la moderación.

`RoomSocketService.errorMessage` pasa a `toSignal(..., { equal: () => false })`: dos rechazos seguidos traen el mismo texto y, con la igualdad por defecto, el segundo no notificaba.

## Risks / Trade-offs

- [Reingreso del moderador justo durante una toma] `join-room.ts` lee el participante y luego hace `Put` del ítem completo con `existing.isModerator`. Si la toma se confirma entre la lectura y el `Put`, el moderador anterior queda con `isModerator = true` aunque `META.moderatorName` apunte al nuevo. → La autorización depende solo de `META`, así que nadie gana permisos; el efecto es un ícono duplicado hasta el próximo cambio. Mitigación: en `join-room.ts`, derivar `isModerator` de `meta.moderatorName === request.name` en vez de copiarlo del ítem previo. La ventana igual existe (lectura de `META` vs. escritura), pero se reduce y queda alineada con la fuente de verdad.
- [Moderador con red inestable pierde el rol] Si el moderador está caído ≥ 60 s, alguien puede tomar el rol y él vuelve como participante común. → Es la decisión 3 del explore; si lo necesita, se lo vuelven a ceder.
- [Desfasaje de reloj] El botón puede aparecer antes o después de los 60 s reales. → El servidor valida; el rechazo se muestra con el componente de aviso (D7).
- [Herencia del rol por nombre] Sigue abierta (fuera de alcance). Dentro de los primeros 60 s, alguien que entre con el nombre del moderador desconectado hereda el rol. Este change no lo empeora.

## Migration Plan

Sin migración de datos. El campo `disconnectedAt` aparece en los ítems a medida que ocurren desconexiones; los legacy se manejan como describe D4. El orden de deploy (backend antes que web) evita que la web mande acciones que el backend no conoce; si llegaran, el `default` responde con su error habitual de acción desconocida. Rollback: revertir el deploy; el campo `disconnectedAt` sobrante es inofensivo.

## Open Questions

(ninguna — las decisiones de producto quedaron cerradas en el explore)
