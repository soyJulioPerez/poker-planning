## 1. Contrato y persistencia de `participantId`

- [x] 1.1 `packages/shared-contracts`: agregar `participantId?: string` a `JoinRoomRequest`.
- [x] 1.2 `packages/room-client-runtime/src/lib/session-store.ts`: agregar `participantId` a `StoredSession`; `SessionStore.save()` pasa a recibir el `participantId` como parámetro (no lo genera).
- [x] 1.3 `packages/room-client-runtime/src/lib/room-client.ts`: nuevo método `generateParticipantId()` (`crypto.randomUUID()`); `saveSession(roomId, name, participantId)` persiste el que recibe; `rejoinIfNeeded` incluye el `participantId` de la sesión guardada en el `joinRoom` que reenvía.
- [x] 1.4 `packages/room-client-runtime/src/lib/room-client.spec.ts`: cubrir generación, persistencia con el id recibido, y reenvío en reingreso.
- [x] 1.5 **(descubierta durante la implementación, ver design.md)** `packages/shared-contracts`: agregar `participantId?: string` a `CreateRoomRequest` también — sin esto, el primer reingreso tras crear una sala nunca tiene un `participantId` server-side contra el cual matchear.
- [x] 1.6 `apps/web/src/app/pages/home/home.ts`: generar el `participantId` con `RoomClient.generateParticipantId()` (vía `RoomSocketService`) al enviar `createRoom`/`joinRoom`, incluirlo en el pedido, y reutilizar el mismo valor al llamar `saveSession(roomId, name, participantId)` en el effect.
- [x] 1.7 `apps/web/src/app/core/room-session-store.ts` y `room-socket.service.ts`: adaptar a la nueva firma de `save`/`saveSession` con `participantId`.

## 2. Servidor: aceptar reingreso por `participantId`

- [x] 2.1 `apps/realtime-api/src/actions/join-room.ts`: reemplazar el chequeo `existing && existing.connected` por la lógica de tres ramas del design (`participantId` coincide → aceptar; no coincide y `connected` → rechazar; no coincide y no `connected` → aceptar). Persistir `participantId` en el `PutCommand` del participante.
- [x] 2.2 `apps/realtime-api/src/actions/join-room.spec.ts`: cubrir las tres ramas — mismo `participantId` con `connected:true` (acepta), `participantId` distinto con `connected:true` (rechaza, como hoy), sin `participantId` en ninguno de los dos lados (fallback legacy, comportamiento sin cambios).
- [x] 2.3 **(descubierta durante la implementación)** `apps/realtime-api/src/actions/create-room.ts`: persistir el `participantId` recibido en el registro del moderador, igual que `join-room.ts`.
- [x] 2.4 `apps/realtime-api/src/actions/create-room.spec.ts`: cubrir que el `participantId` recibido queda persistido en el registro del moderador.

## 3. Reconexión automática con backoff

- [x] 3.1 `packages/room-client-runtime/src/lib/room-client.ts`: guardar internamente el `roomId` de la sesión activa; en el listener `close`, si hay sesión guardada para ese `roomId`, programar reintento con backoff exponencial (1s/2s/4s/8s, tope 10s) que reconecta y reenvía `joinRoom` sin pasar por el guard de "ya hay `room` cargado".
- [x] 3.2 `packages/room-client-runtime/src/lib/room-client.spec.ts`: cubrir los tres escenarios de "Reconexión automática tras pérdida de conexión" — cierre con sesión activa reintenta, cierre sin sesión activa no reintenta, backoff creciente entre intentos.

## 4. Logging de desarrollo

- [x] 4.1 `packages/room-client-runtime/src/lib/room-client.ts`: agregar `console.log`/`console.warn` en los puntos de vida de la conexión (conectando, conectado, cerrado, reintento programado, reingreso enviado, reingreso aceptado, reingreso rechazado).
- [x] 4.2 `packages/room-client-runtime/src/lib/room-client.spec.ts`: cubrir que el cierre y el reintento emiten registro en consola (spy sobre `console.log`/`warn`).

## 5. `RoomPage` deja de quedar mudo

- [x] 5.1 `apps/web/src/app/pages/room/room.ts`: consumir `connected` y `joinRejectedReason` de `RoomSocketService`, siguiendo el patrón ya usado en `home.ts` (`home.ts:46, 69-73`).
- [x] 5.2 `apps/web/src/app/pages/room/room.ts` + `room.html`: si `joinRejectedReason` recibe un valor, redirigir a `/` con `?room=<roomIdFromUrl>` (mismo camino que la rama `else` de `room.ts:34`).
- [x] 5.3 `apps/web/src/app/pages/room/room.html`: mientras `connected()` es `false` y todavía hay `room()` cargado (reconectando a mitad de sesión), mostrar un indicador no bloqueante en vez de reemplazar la vista de la sala.
- [x] 5.4 `apps/web/src/app/pages/room/room.spec.ts`: cubrir la redirección tras rechazo y el indicador de reconexión sin perder la vista de la sala.

## 6. Verificación manual

- [x] 6.1 Repetir contra el stack local los dos escenarios reproducidos en el explore (cierre silencioso del socket; `connected:true` estancado en DynamoDB al reingresar) y confirmar que ya no cuelgan — la UI muestra el estado de reconexión o redirige con motivo, y la consola registra el ciclo de vida de la conexión.

  **Verificado en vivo** (stack local, navegador real vía Playwright, sala `963LZ8`):
  - Cierre forzado del socket: consola registra `connection.closed` → `connection.reconnect_scheduled {delayMs:1000}` → `rejoin.sent` → `connection.open` → `rejoin.accepted`, reconecta solo en ~1s, la sala nunca se muestra rota.
  - Mismo mecanismo exacto que colgaba en el explore (borrar la fila `CONN#` antes de que corra la limpieza, dejando `connected:true` estancado) + refresh: antes se quedaba en "Conectando..." para siempre; ahora `rejoin.accepted` de inmediato, sala cargada, 0 errores y 0 warnings en consola — acepta por `participantId` sin mirar `connected`.
