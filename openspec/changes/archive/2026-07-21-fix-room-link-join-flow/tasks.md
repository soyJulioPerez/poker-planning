## 1. Corregir el link compartible

- [x] 1.1 En `apps/web/src/app/pages/room/room.ts`, cambiar `shareLink` para derivar la URL de `window.location.href` en vez de reconstruirla a mano con `window.location.origin` + `/room/${roomId}`
- [x] 1.2 Verificar manualmente (local o producción) que el link mostrado en "Compartí este link" incluye el `base-href` correcto — verificado con Playwright contra build local (`--configuration=aws`): el link mostrado coincide exactamente con la URL real del navegador

## 2. Detectar acceso sin sesión y redirigir

- [x] 2.1 Agregar en `RoomSocketService` (o donde se decida) una forma de verificar si existe una sesión guardada en `sessionStorage` para un `roomId` dado, reutilizando el parseo ya existente en `rejoinIfNeeded` — agregado `hasSessionFor(roomId)`, extraído `getSessionFor()` privado compartido con `rejoinIfNeeded`
- [x] 2.2 En `RoomPage.constructor()`, si no hay sesión guardada para `roomIdFromUrl`, navegar a `/` con `queryParams: { room: roomIdFromUrl }` en vez de llamar a `rejoinIfNeeded`
- [x] 2.3 Confirmar que el caso con sesión previa (`rejoinIfNeeded` con sesión existente) sigue funcionando exactamente igual que antes — verificado en tarea 4.4

## 3. Precargar Home desde el query param

- [x] 3.1 En `Home`, leer `route.snapshot.queryParamMap.get('room')` al inicializar
- [x] 3.2 Si el query param está presente: forzar `mode.set('join')`, precargar `joinRoomId` (normalizado a mayúsculas)
- [x] 3.3 Extraer la lógica compartida por `onJoinRoomIdBlur()` (connect + `getRoomInfo`) a un método privado reutilizable (`fetchRoomInfoForJoin()`), y llamarlo también cuando se precarga desde el query param
- [x] 3.4 Verificar que si la sala precargada tiene un grupo de íconos asignado, el selector de íconos aparece automáticamente sin que el usuario tenga que interactuar con el campo — verificado con Playwright

## 4. Verificación end-to-end

- [x] 4.1 Crear una sala, copiar el `shareLink` mostrado, abrirlo en una pestaña/contexto sin sesión previa — confirmar que redirige a Home con "Unirse a sala" activo y el código precargado — verificado: `/room/FPAHPH` → `/?room=FPAHPH` automáticamente, código "FPAHPH" precargado
- [x] 4.2 Completar el nombre y unirse desde ese estado precargado — confirmar que el flujo de unión funciona normalmente de ahí en adelante — verificado: participante se unió correctamente y apareció en la lista con su ícono
- [x] 4.3 Repetir el caso anterior con una sala que tenga un grupo de íconos asignado — confirmar que el selector de íconos aparece precargado — verificado en el mismo flujo (sala creada con grupo "Emociones")
- [x] 4.4 Confirmar que recargar la página estando ya dentro de una sala (con sesión guardada) sigue reconectando automáticamente, sin redirigir a Home — verificado: recarga de `/room/FPAHPH` con sesión existente reconectó sin redirigir
- [x] 4.5 Confirmar que el spec e2e existente (`e2e/estimation-flow.spec.ts`) sigue pasando sin cambios — verificado: `npm run test:e2e:aws` → 1 passed (19.5s)
