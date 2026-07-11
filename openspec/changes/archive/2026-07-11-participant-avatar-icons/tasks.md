## 1. Shared contracts

- [x] 1.1 Agregar tipo `IconGroup { id, label, icons: string[] }` en `packages/shared-contracts/src/lib/domain.ts`
- [x] 1.2 Crear catálogo `AVAILABLE_ICON_GROUPS` (Hobbies, Emociones, Animales, ~12 emojis c/u) en un nuevo archivo `packages/shared-contracts/src/lib/icon-groups.ts`, exportado desde `index.ts`
- [x] 1.3 Agregar `iconGroupId: string | null` a `Room` y `icon: string | null` a `Participant` en `domain.ts`
- [x] 1.4 Agregar `iconGroupId?: string` a `CreateRoomRequest`, `icon?: string` a `JoinRoomRequest`, y nuevos mensajes `GetRoomInfoRequest { action: 'getRoomInfo', roomId }` / `RoomInfoMessage { type: 'roomInfo', iconGroupId: string | null, deckId: string }` en `messages.ts`, incluyéndolos en los union types `ClientRequest`/`ServerMessage`

## 2. Backend (apps/realtime-api)

- [x] 2.1 Agregar handler `handleGetRoomInfo` (consulta de solo lectura vía `getRoomMeta`) que responde `roomInfo` o `joinRejected: room-not-found`
- [x] 2.2 Registrar la nueva acción `getRoomInfo` en el router de acciones del WebSocket
- [x] 2.3 Actualizar `handleCreateRoom` para persistir `iconGroupId` en la sala y `icon` en el participante moderador (validando que el ícono pertenezca al grupo elegido; si no, guardar `icon: null`)
- [x] 2.4 Actualizar `handleJoinRoom` para validar que el `icon` recibido pertenezca al `iconGroupId` de la sala (si la sala no tiene grupo, ignorar cualquier `icon` recibido) y persistirlo en el participante
- [x] 2.5 Actualizar `room-repository.ts` (`buildRoomState`/mapeo de participantes) para incluir `iconGroupId` e `icon` en el `Room` reconstruido

## 3. Frontend — formulario de sala (apps/web)

- [x] 3.1 Crear componente reutilizable `IconPicker` (grilla de emojis clickeable) que reciba un `IconGroup` y emita el ícono elegido
- [x] 3.2 En `home.html`/`home.ts`, agregar selector de grupo de íconos ("Ninguno" + `AVAILABLE_ICON_GROUPS`) al formulario de "Crear sala"; si se elige un grupo, mostrar `IconPicker` para que el moderador elija su ícono antes de habilitar el submit
- [x] 3.3 Incluir `iconGroupId` e `icon` en el mensaje `createRoom` enviado por `Home`
- [x] 3.4 En el formulario de "Unirse a sala", disparar `getRoomInfo` cuando el código de sala esté completo (ej. on blur) y guardar el `iconGroupId`/`deckId` de la respuesta
- [x] 3.5 Si la respuesta indica `iconGroupId` no nulo, mostrar `IconPicker` con los íconos de ese grupo y exigir selección antes de habilitar "Unirse"; si es nulo, no mostrar ningún selector
- [x] 3.6 Incluir el `icon` elegido en el mensaje `joinRoom` enviado por `Home` (solo si aplica)

## 4. Frontend — visualización en la lista de participantes

- [x] 4.1 Agregar input `icon` (o derivarlo de `participant.icon`) en `ParticipantList` y pintarlo a la izquierda del nombre cuando exista
- [x] 4.2 Para el moderador, mostrar `ModeratorBadge` seguido del ícono de avatar (si existe), ambos antes del nombre
- [x] 4.3 Verificar que participantes sin ícono (sala sin grupo) se vean exactamente igual que antes del cambio
- [x] 4.4 Mostrar mensaje de error visible ("Elegí un ícono para crear/unirte a la sala") si el moderador o el participante intentan enviar el formulario sin seleccionar ícono, cuando la sala tiene un grupo activo

## 5. Validación manual

- [x] 5.1 Crear una sala con "Ninguno" como grupo de íconos y confirmar que no aparece ningún selector para quien se une, y que la lista de participantes no muestra avatares
- [x] 5.2 Crear una sala eligiendo un grupo (ej. Animales) y el ícono del moderador; confirmar que se ve `🧙 + ícono` junto al nombre del moderador en la lista
- [x] 5.3 Unirse a esa sala como otro participante y confirmar que el selector de íconos aparece, es obligatorio, y el ícono elegido se pinta a la izquierda del nombre
- [x] 5.4 Confirmar que dos participantes pueden elegir el mismo ícono sin error, y que ambos se distinguen correctamente por nombre
