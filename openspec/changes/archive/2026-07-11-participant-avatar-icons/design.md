## Context

Hoy `Room` tiene `deckId` (referencia a un `DeckOption` del catálogo estático `AVAILABLE_DECKS`) y `Participant` no tiene ningún campo de identidad visual más allá de `isModerator` (que se pinta con el emoji 🧙 vía `ModeratorBadge`). El flujo de creación/unión de sala vive en `Home` (`apps/web/src/app/pages/home/`), que envía `createRoom`/`joinRoom` por WebSocket a `apps/realtime-api`, donde `handleCreateRoom`/`handleJoinRoom` persisten el registro en DynamoDB y devuelven el `Room` completo (o lo difunden a todos vía `broadcastRoomState`).

Este cambio agrega un catálogo estático de `IconGroup` (paralelo a `DeckOption`), un campo opcional `iconGroupId` en `Room`, y un campo opcional `icon` en `Participant`.

## Goals / Non-Goals

**Goals:**
- Catálogo estático de 3 `IconGroup` (Hobbies, Emociones, Animales), ~12 emojis cada uno.
- El moderador elige grupo (o "Ninguno") y su propio ícono al crear la sala.
- Si la sala tiene grupo asignado, quien se une elige un ícono de ese grupo (obligatorio).
- El ícono se pinta a la izquierda del nombre en `ParticipantList`; el moderador muestra 🧙 + su ícono elegido.
- Sin grupo asignado, el comportamiento visual es idéntico al actual (sin selector, sin ícono extra).

**Non-Goals:**
- No se valida ni fuerza unicidad de ícono entre participantes (colisiones permitidas).
- No se rediseña `reveal-panel` en este cambio (el ícono ahí queda fuera de alcance).
- No se permite editar el ícono después de unirse a la sala (se fija al unirse/crear).
- No se agregan íconos personalizados/subida de imágenes; solo emojis del catálogo.

## Decisions

**1. Modelo de datos — catálogo estático + referencia por id**
Igual patrón que `DeckOption`/`AVAILABLE_DECKS`: `IconGroup { id, label, icons: string[] }` en `shared-contracts`, catálogo `AVAILABLE_ICON_GROUPS`. `Room.iconGroupId: string | null` (null = "Ninguno"). `Participant.icon: string | null` (null cuando la sala no tiene grupo, o si en algún momento futuro se decide hacerlo opcional aun con grupo activo — no es el caso hoy, pero el tipo lo permite sin migración).

*Alternativa descartada*: guardar el emoji directamente en `Room` sin catálogo tipado — se pierde la validación de "ícono pertenece al grupo" y la consistencia con el patrón de mazos ya existente.

**2. Selector condicional, no "Ninguno" en el picker de ícono**
Como se definió en la exploración: el selector de ícono en "Unirse a sala" solo aparece si la sala tiene `iconGroupId` no nulo (se resuelve via un mensaje previo o incluido en la respuesta de error/consulta — ver Riesgo de "sala no encontrada" abajo). El "Ninguno" solo existe como opción de grupo al crear la sala, no como opción de ícono individual.

**3. Descubrir el grupo de la sala antes de unirse**
Hoy `joinRoom` es fire-and-forget: se envía `{action: 'joinRoom', roomId, name}` y el servidor responde con el estado completo o un rechazo. Para mostrar el selector de ícono condicionalmente, el cliente necesita saber `iconGroupId` **antes** de enviar `joinRoom` (ya que el ícono debe ir en esa misma request). Se agrega una consulta liviana: `{action: 'getRoomInfo', roomId}` → respuesta `{type: 'roomInfo', iconGroupId, deckId}` (o `{type: 'joinRejected', reason: 'room-not-found'}` si no existe), disparada cuando el usuario completa el código de sala (ej. on blur / debounce), antes de mostrar el resto del formulario de unión.

*Alternativa descartada*: pedir el ícono en un segundo paso después de unirse (post-join). Se descartó porque el ícono se define como parte de la identidad del participante desde su primer registro en `ParticipantList`, igual que el nombre, y evita un estado transitorio "unido pero sin ícono".

**4. Orden visual: `[🧙][avatar] Nombre`**
En `ParticipantList` y `ModeratorBadge`, el ícono de moderador sigue siendo un componente separado; se agrega el avatar del participante (si existe) entre el badge de moderador (si aplica) y el nombre. Para no-moderadores sin badge, queda `[avatar] Nombre`.

**5. Reutilización del patrón de `AVAILABLE_DECKS` en el formulario**
El selector de grupo en "Crear sala" es un `<select>` igual al de mazo (mismo patrón ya validado en `home.html`). El selector de ícono (grilla) es un componente nuevo y pequeño, reutilizado tanto en "Crear sala" (para el ícono del moderador) como en "Unirse a sala".

## Risks / Trade-offs

- [Riesgo] La consulta previa `getRoomInfo` agrega una ida y vuelta extra al flujo de unión, y un nuevo tipo de mensaje al protocolo WebSocket → Mitigación: mensaje mínimo, sin efectos secundarios en el servidor (solo lectura), y solo se dispara si el usuario ya escribió un código de sala completo.
- [Riesgo] Un usuario podría enviar `joinRoom` con un `icon` que no pertenece al `iconGroupId` real de la sala (cliente desactualizado o manipulado) → Mitigación: el servidor valida que el ícono recibido pertenezca al grupo configurado en la sala; si no, lo ignora y guarda `icon: null`.
- [Trade-off] El ícono se fija al unirse/crear, sin edición posterior — más simple, pero un participante no puede cambiar de avatar sin abandonar y volver a unirse (mismo patrón ya aceptado para el nombre).

## Migration Plan

No aplica (sin datos persistentes de producción a migrar; las salas son efímeras). Las salas creadas antes de este cambio ya habrán expirado antes del deploy dado el TTL de la tabla.

## Open Questions

- Ninguna bloqueante — el usuario indicó que ajustará detalles visuales (orden, tamaño de la grilla) después de ver el resultado funcionando.
