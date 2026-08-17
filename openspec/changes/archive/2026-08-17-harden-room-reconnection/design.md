## Context

Reproducido en vivo (stack local: DynamoDB Local + `dev:api` + `web`, navegador real vía Playwright) durante `/opsx:explore`:

1. Forzando el cierre del WebSocket, la UI queda congelada mostrando el último estado sin ningún aviso — `RoomClient.connect()` (`packages/room-client-runtime/src/lib/room-client.ts`) solo hace `connectedSubject.next(false)` en su listener `close`; `RoomPage` (`apps/web/src/app/pages/room/room.ts`) nunca lee ese estado.
2. Forzando que el servidor todavía vea `connected:true` para el participante al momento del reingreso (borrando la fila de tracking de la conexión antes de que corriera la limpieza), `join-room.ts` rechaza con `joinRejected{reason:'name-taken'}`. `RoomPage` tampoco lee `joinRejectedReason` — a diferencia de `home.ts`, que sí lo maneja para el join manual (`home.ts:46, 69-73`). Resultado: "Conectando a la sala..." para siempre, sin recuperación.

El disparador real en producción de por qué `connected` puede seguir en `true` (hipótesis: cold start de la Lambda `$disconnect`, la ruta menos invocada, compitiendo con un rejoin rápido) no se confirmó contra AWS real. Este diseño no depende de confirmarlo.

## Goals / Non-Goals

**Goals:**
- Que el reingreso desde la misma sesión (misma pestaña, con o sin recarga) nunca dependa del timing de la limpieza de la conexión anterior.
- Que ningún estado de conexión (perdida, reintentando, rechazada) deje a la UI en un limbo silencioso.
- Que el comportamiento para dos sesiones distintas compitiendo por el mismo nombre no cambie — sigue siendo tan estricto como hoy.
- Dar visibilidad de desarrollo (consola del navegador) sobre el ciclo de vida de la conexión.

**Non-Goals:**
- Resolver la ambigüedad de "sesión perdida (compu apagada) + mismo nombre" con algo más fuerte que el chequeo de `connected` actual (ej. código de recuperación, override del moderador). Discutido explícitamente y descartado: es una limitación inherente a no tener autenticación, no algo que este change deba cerrar.
- Confirmar el disparador exacto contra AWS real de por qué `connected` queda en `true`. No bloquea el diseño.
- Pipeline de telemetría o envío de logs del frontend a un backend. El logging de este change es de consola, para pruebas de desarrollo.
- Auditar o modificar `apps/mobile`. Hereda el cambio de protocolo por compartir `room-client-runtime`/`shared-contracts`, pero su UI propia queda fuera de alcance.

## Decisions

### 1. Identidad de sesión: `participantId` persistido, no reemplaza a `connected`

`SessionStore`/`StoredSession` gana un `participantId` (`crypto.randomUUID()`, generado una sola vez por sesión guardada). Se envía en todo `ClientRequest` de tipo `joinRoom` — join inicial y reingreso automático. El participante en DynamoDB lo persiste junto al resto de sus atributos.

`join-room.ts` cambia su chequeo de:
```
existing && existing.connected → rechazar
```
a:
```
existing && existing.participantId === request.participantId → aceptar (misma sesión, sin ambigüedad)
existing && existing.participantId !== request.participantId && existing.connected → rechazar (como hoy)
existing && existing.participantId !== request.participantId && !existing.connected → aceptar (como hoy)
sin existing.participantId (legacy) → cae en las dos ramas de arriba, tratado como "no coincide"
```

**Alternativas consideradas:**
- *Verificar liveness real de la conexión vieja contra la API de AWS (`PostToConnection` → `GoneException` si está muerta)* — cierra la ventana de carrera pero no la elimina, y no aplica igual al emulador local (`ws` plano) que a producción (API Gateway Management API), lo que hubiera dejado dos implementaciones distintas del mismo chequeo. Descartada a favor de una identidad explícita que funciona igual en ambos entornos.
- *Reemplazar `connected` por completo con `participantId`* — descartada explícitamente: sin `participantId` coincidente no hay forma de saber si es la misma persona, y degradar la protección contra nombre duplicado a "cualquiera que sepa el nombre entra" abre exactamente el escenario de impersonación que se quiso evitar.

**Hallazgo durante la implementación, no anticipado al proponer el change**: para que el *primer* reingreso después del `createRoom`/`joinRoom` inicial ya use el camino determinístico, el `participantId` tiene que viajar también en ese mensaje inicial — no alcanza con incluirlo recién en `rejoinIfNeeded`. Si el servidor nunca recibió un `participantId` antes del primer corte de conexión, ese primer reingreso cae en el fallback de siempre (idéntico a hoy), y es exactamente el escenario que se reprodujo en el explore (crear sala → cortar conexión → reingresar). Por eso `CreateRoomRequest` también gana `participantId?: string`, y `create-room.ts` lo persiste en el registro del moderador igual que `join-room.ts` lo hace para cualquier otro participante. El cliente (`home.ts`) genera el `participantId` con `RoomClient.generateParticipantId()` en el momento de armar el pedido de `createRoom`/`joinRoom`, lo incluye en ese pedido, y reutiliza el mismo valor al llamar `saveSession(roomId, name, participantId)` una vez confirmada la sala — así el id que el servidor ya conoce y el que queda persistido localmente son siempre el mismo.

### 2. Reconexión automática: reintento con backoff, re-enviando `joinRoom` siempre

Hoy `rejoinIfNeeded(roomId)` corta si `roomSubject.value` ya tiene una sala cargada (`room-client.ts:117`) — pensado para el chequeo de montaje ("no reingresar si ya hay estado"), pero eso mismo bloquearía un reingreso real tras una desconexión a mitad de sesión, porque `room` sigue con el último valor conocido aunque el socket ya se haya caído.

El `RoomClient` guarda internamente el `roomId` de la sesión activa (el mismo que ya recibe `rejoinIfNeeded`). En el listener `close`, si hay una sesión guardada para ese `roomId`, programa un reintento de conexión con backoff exponencial (1s, 2s, 4s, 8s, tope en 10s, sin límite de intentos) que vuelve a `connect()` y reenvía `joinRoom` — sin pasar por el guard de "ya hay `room` cargado", que queda reservado para el chequeo de montaje inicial.

Si no hay sesión guardada para ese `roomId` (la sala se cerró con `roomClosed`, que ya limpia la sesión, o el usuario nunca llegó a unirse), no se reintenta nada.

**Alternativas consideradas:**
- *Reintento manual únicamente (mostrar botón "Reconectar")* — más simple, pero no resuelve el caso reportado (usuario que no vuelve a mirar la pestaña hasta más tarde). El backoff automático cubre ambos casos: quien está mirando ve "Reconectando..." y quien vuelve más tarde ya está reconectado.

### 3. `RoomPage` consume `connected` y `joinRejectedReason`

Mismo patrón que ya usa `home.ts` para el join manual. Nuevo estado en el template: mientras `connected()` es `false` y todavía hay `room()` cargado (reconectando a mitad de sesión), mostrar un indicador no bloqueante en vez de reemplazar la vista de la sala — el participante no pierde el contexto de lo que estaba viendo. Si llega `joinRejectedReason`, redirigir a `/` con `?room=<código>`, igual que el camino ya existente para "sin sesión guardada" (`room.ts:34`).

### 4. Logging de desarrollo en `RoomClient`

`console.log`/`console.warn` (sin nivel `error` salvo fallos reales de parseo) en: intento de conexión, conexión abierta, conexión cerrada, reintento programado (con el delay), reingreso enviado, reingreso aceptado, reingreso rechazado. Vive en `room-client-runtime` porque ahí está el ciclo de vida real de la conexión — no se fuerza dentro de la capability `observability`, que hoy es específicamente logging estructurado de backend hacia CloudWatch (formato y consumidor distintos).

## Risks / Trade-offs

- **[Riesgo] El disparador real de `connected:true` estancado no está confirmado contra AWS.** → Mitigación: el diseño no depende de identificarlo — el `participantId` cierra el caso común (misma sesión) sin necesitar saber por qué `connected` quedaba mal, y el caso sin `participantId` se comporta exactamente igual que hoy, sin empeorar nada.
- **[Riesgo] Deploy no atómico (web vía GitHub Pages, backend vía Lambda) puede dejar una ventana con cliente viejo (sin `participantId`) hablando con backend nuevo, o viceversa.** → Mitigación: el campo es opcional en el protocolo; su ausencia cae naturalmente en la rama de fallback ya diseñada para participantes legacy, sin necesitar ninguna lógica de migración.
- **[Riesgo] El backoff sin límite de intentos podría reconectar indefinidamente a una sala que el servidor ya cerró por inactividad (TTL expirado).** → Mitigación: si la sala ya no existe, `getRoomMeta` en `join-room.ts` devuelve `room-not-found` (rama ya manejada por `joinRejectedReason`), lo que corta el ciclo redirigiendo a inicio en vez de seguir reintentando contra una sala fantasma.

## Migration Plan

No requiere pasos manuales de migración de datos: los participantes ya conectados al momento del deploy simplemente no tienen `participantId` guardado hasta su próximo `joinRoom`, y ese caso ya está cubierto por el fallback. No hay downtime ni backfill necesario.
