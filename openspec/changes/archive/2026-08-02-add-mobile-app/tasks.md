## 1. Scaffold de `apps/mobile`

- [x] 1.1 Agregar `@nx/expo` al workspace (`nx add @nx/expo`) y generar `apps/mobile` con `@nx/expo:application` — versión `23.0.1` para matchear el resto de `@nx/*` del workspace; generado con `--linter=eslint --unitTestRunner=jest --e2eTestRunner=none --useProjectJson=true`, consistente con el resto del repo
- [x] 1.2 Confirmar qué solución de navegación trae el generador por defecto; si no trae ninguna, agregar React Navigation (ver decisión en `design.md`, punto 2) — no trae ninguna (solo `App.tsx` plano); se agregó `@react-navigation/native` + `@react-navigation/native-stack` (con `react-native-screens`/`react-native-safe-area-context`) vía `expo install` para versiones compatibles con el SDK de Expo, luego normalizado a las convenciones del repo (deps reales en `package.json` raíz, `"*"` en `apps/mobile/package.json`, sin `node_modules` local)
- [x] 1.3 Configurar `EXPO_PUBLIC_WS_URL` (variable de entorno pública de Expo) apuntando al mismo backend local (`ws://localhost:3001`) que usa `apps/web` en desarrollo — `apps/mobile/.env` (mismo default que `apps/web/src/environments/environment.ts`, committeado igual que ese archivo)
- [x] 1.4 Declarar `shared-contracts` y `room-client-runtime` como dependencias de `apps/mobile` — agregadas a `apps/mobile/package.json` (mismo patrón `"0.0.1"` que usa `packages/room-client-runtime/package.json` para referenciar `shared-contracts`); la resolución real la maneja `withNxMetro` (metro.config.js) + los path aliases de `tsconfig.base.json`, no npm

## 2. Conexión mínima end-to-end (validar el stack antes de portar todo)

- [x] 2.1 Implementar un `SessionStore` en memoria en `apps/mobile` que satisfaga la interfaz de `room-client-runtime` — `apps/mobile/src/app/core/session-store.ts`
- [x] 2.2 Instanciar `RoomClient` con `EXPO_PUBLIC_WS_URL` y el `SessionStore` de mobile, confirmando que el `WebSocketFactory` por defecto (WebSocket global de React Native) conecta sin necesitar una implementación custom — `apps/mobile/src/app/core/room-client-context.tsx` (Context de React) + `use-observable.ts`/`use-room-client.ts` (hooks para consumir los `Observable` del runtime, equivalentes a los signals de `RoomSocketService` en la web)
- [x] 2.3 Pantalla mínima de prueba: crear una sala y mostrar el `roomId`/estado de sala recibido del backend, para validar que todo el pipeline (Expo → room-client-runtime → realtime-api) funciona antes de construir el resto de la UI — `App.tsx` reescrito con `ConnectionTestScreen`; validado con `nx test mobile` (jest), `nx export mobile` (bundle real de Metro para web/iOS/Android) **y en un dispositivo Android real vía Expo Go** (conexión WebSocket, creación de sala y estado recibido del backend, todo confirmado funcionando end-to-end). Nota: se detectó y corrigió que `expo install` había creado un `node_modules` local en `apps/mobile` (rompía la convención de node_modules único del repo), que el jest config generado (`preset: jest-expo`) no resuelve los path aliases de Nx (se agregó `moduleNameMapper` manual), y que el SDK de Expo inicial (`~55`) no era compatible con la versión de Expo Go publicada en Play Store — se bajó a SDK 54 (`expo ~54.0.36`) realineando todo el árbol de dependencias correlacionadas. Bug no bloqueante encontrado y documentado en `openspec/known-issues.md`: los assets de ícono/splash no resuelven bien en el asset-server de Metro dentro de este monorepo Nx.

## 3. Pantalla Home (crear / unirse)

- [x] 3.1 Formulario "Crear sala": nombre del moderador, selección de mazo (`AVAILABLE_DECKS` de `shared-contracts`), grupo de íconos opcional (`AVAILABLE_ICON_GROUPS`), indicador de carga y manejo de timeout/error (paridad con `room-management`, ver `specs/mobile-app/spec.md`) — `apps/mobile/src/app/screens/HomeScreen.tsx`
- [x] 3.2 Formulario "Unirse a sala": input de código/ID de sala, nombre, selección de ícono si la sala tiene grupo de íconos asignado, manejo de "nombre ya en uso" — mismo archivo, tab "Unirse a sala"
- [x] 3.3 Navegación de Home a la pantalla de Room al crear/unirse exitosamente — `RootNavigator.tsx` (`@react-navigation/native-stack`), `navigation.replace('Room', {roomId})` cuando `room`+`myName` están listos (equivalente al `effect` de `home.ts`)

## 4. Pantalla Room

- [x] 4.1 Lista de participantes en vivo, con badge de moderador y estado "desconectado" (sin eliminar al participante de la lista) — `apps/mobile/src/app/ui/ParticipantList.tsx`
- [x] 4.2 Tablero de votación (mazo seleccionado), envío de voto oculto — `ui/VotingBoard.tsx` + `ui/Card.tsx`
- [x] 4.3 Revelado simultáneo de votos, con cálculo de promedio/moda mostrado igual que en la web — `ui/RevealPanel.tsx`
- [x] 4.4 Controles de moderador: revelar, resolver (aceptar promedio/moda o sobreescribir valor), nueva ronda, toggle "moderador vota" (deshabilitado durante una ronda activa) — visibles solo para el moderador — `screens/RoomScreen.tsx`
- [x] 4.5 Reconexión automática dentro de la misma apertura de la app tras pérdida de red (usa `rejoinIfNeeded` de `room-client-runtime`) — implementado en el mount effect de `RoomScreen`; lógica ya cubierta por los unit tests de `room-client-runtime`, pendiente de probar manualmente en dispositivo (tarea 6.3)

## 5. Resumen de sesión

- [x] 5.1 Contador de historias estimadas y puntuación acumulada visible durante la sesión — header de `RoomScreen`
- [x] 5.2 Resumen final (lista de historias + puntaje total) al cerrar la sala como moderador — `RoomScreen` renderiza el resumen cuando `roomSummary` está presente

**Verificación de esta pasada:** `nx test mobile` (jest, mock oficial de `react-native-safe-area-context` — se encontró y corrigió que exportaba vía `export default`, no exports nombrados), `tsc --noEmit` (0 errores; se encontró y corrigió una limitación real de narrowing de TS a través de closures en dos lugares), `nx lint mobile` (0 problemas propios; solo queda el error sistémico preexistente de `@nx/enforce-module-boundaries`), `nx export mobile` (bundle real de Metro para web/iOS/Android con toda la navegación). **Pendiente:** probar la UI completa en el dispositivo real (hasta ahora solo se probó la pantalla de conexión mínima del bloque 2) — ver bloque 6.

## 6. Verificación manual (sin e2e automatizado, ver Non-Goals en `design.md`)

- [x] 6.1 Flujo completo crear → votar → revelar → resolver → nueva historia, con al menos dos dispositivos/simuladores (moderador + participante) — probado por el usuario en un dispositivo Android real ("probé bastante por encima", 2026-08-02)
- [ ] 6.2 Nombre duplicado rechazado al unirse
- [ ] 6.3 Reconexión tras pérdida de red dentro de la misma apertura de la app
- [ ] 6.4 Confirmar que cerrar y reabrir la app no conserva sesión (comportamiento esperado de la implementación en memoria)
- [ ] 6.5 Confirmar en paralelo que la web (`apps/web`) sigue funcionando sin cambios — mismo backend, misma sala, participantes mixtos web + mobile en la misma sesión

**Decisión del usuario (2026-08-02):** se da por completa la funcionalidad mobile con la verificación general ya hecha (6.1). Las tareas 6.2-6.5 quedan pendientes deliberadamente — se cubrirán en detalle cuando se implemente la suite e2e de mobile (change futuro, ver Non-Goals en `design.md`), en vez de seguir haciendo pasadas manuales exhaustivas ahora.
