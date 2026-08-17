## Why

Un participante que recarga la página (o reconecta tras perder la conexión) puede quedar colgado para siempre en "Conectando a la sala...", sin ningún error visible ni rastro en la consola o la red. Se reprodujo en vivo contra el stack local: (1) un cierre de WebSocket deja la UI congelada en silencio porque nada consume el estado `connected`, y (2) si el servidor todavía cree que el participante sigue conectado al momento del reingreso, rechaza el `joinRoom` con `name-taken` y ese rechazo tampoco se maneja — la pantalla de sala nunca se entera. El mecanismo exacto que deja a `connected` en `true` en producción no está confirmado, pero el diseño elegido no depende de confirmarlo: en vez de angostar la ventana de carrera, la elimina para el caso común (misma pestaña reconectando) y deja el caso ambiguo (sesión perdida) exactamente como se comporta hoy.

## What Changes

- El runtime de cliente (`room-client-runtime`) persiste un `participantId` por sesión (generado una vez, guardado junto a `roomId`/`name`) y lo envía en todo `joinRoom`, tanto el ingreso inicial como el reingreso automático.
- El servidor (`join-room.ts`) acepta el reingreso sin ambigüedad cuando el `participantId` recibido coincide con el del participante existente, sin depender del flag `connected`. Cuando no coincide (sesión nueva, o participante legacy sin `participantId` guardado) el comportamiento queda exactamente igual al actual: rechaza si `connected` es `true`, acepta si es `false`.
- La pantalla de sala (`RoomPage`) deja de ignorar el estado de conexión: si el reingreso es rechazado, redirige a inicio con el código precargado (mismo camino ya usado para "sin sesión guardada"), mostrando el motivo en vez de quedar en carga indefinida.
- El runtime reintenta la conexión automáticamente cuando el WebSocket se cierra, en vez de no hacer nada.
- El runtime agrega logging de desarrollo (consola del navegador) en los puntos de vida de la conexión — conectando, conectado, desconectado, reintentando, reingreso aceptado/rechazado — sin ningún pipeline de telemetría ni envío a un backend.

## Capabilities

### New Capabilities

(ninguna — el cambio se resuelve dentro de capabilities existentes)

### Modified Capabilities

- `room-management`: el requirement "Reconexión automática" pasa a identificar al participante también por `participantId` de sesión, no solo por nombre+sala. Se agrega comportamiento explícito para cuando el reingreso automático es rechazado (hoy no está definido qué pasa; en la práctica queda colgado).
- `room-client-runtime`: el requirement "Reingreso automático a una sala con sesión guardada" cambia para incluir el `participantId` persistido en cada intento. Se agregan dos requirements nuevos: reconexión automática tras pérdida de conexión, y logging de eventos del ciclo de vida de la conexión.

## Impact

- `packages/shared-contracts`: `JoinRoomRequest` y `CreateRoomRequest` ganan el campo `participantId` — necesario en ambos porque el primer reingreso después de cualquiera de los dos debe poder usar el camino determinístico (ver design.md, hallazgo de implementación).
- `packages/room-client-runtime`: `SessionStore`/`StoredSession` (nuevo campo), `RoomClient` (nuevo método para generar `participantId`, reenvío en reingreso, reconexión automática, logging).
- `apps/realtime-api`: `join-room.ts` (nueva rama de aceptación por `participantId`) y `create-room.ts` (persiste el `participantId` recibido en el registro del moderador).
- `apps/web`: `home.ts` genera el `participantId` al enviar `createRoom`/`joinRoom` y lo reutiliza al guardar la sesión.
- `apps/web`: `RoomPage`/`room.ts` consume `connected` y `joinRejectedReason` de `RoomSocketService`; redirige en caso de rechazo.
- `apps/mobile`: hereda el cambio de protocolo automáticamente al compartir `room-client-runtime`/`shared-contracts`; no se audita su UI propia en este change.
- Participantes ya existentes en salas activas al momento del deploy no tienen `participantId` guardado — caen en el comportamiento de fallback (idéntico al actual), sin romper sesiones en curso.
