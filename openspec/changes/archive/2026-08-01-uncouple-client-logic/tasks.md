## 1. Scaffold de `packages/room-client-runtime`

- [x] 1.1 Generar la lib Nx `packages/room-client-runtime` siguiendo el mismo patrón que `packages/shared-contracts` (`project.json` con target `build` vía `@nx/js:tsc`, `tsconfig.json`/`tsconfig.lib.json`/`tsconfig.spec.json`, `eslint.config.mjs`, `jest.config.cts`)
- [x] 1.2 Agregar el path alias `room-client-runtime` en `tsconfig.base.json` apuntando a `packages/room-client-runtime/src/index.ts`
- [x] 1.3 Declarar `shared-contracts` como dependencia del paquete nuevo

## 2. Migrar la lógica de conexión y estado

- [x] 2.1 Definir la interfaz `SessionStore` (`get(roomId): {name} | null`, `save(roomId, name): void`, `clear(): void`) en el paquete nuevo
- [x] 2.2 Definir el tipo de configuración de conexión (URL del WebSocket) recibido al construir el cliente, en vez de leerlo de `environment.ts`
- [x] 2.3 Portar la lógica de conexión/reconexión y cola de `pendingMessages` de `room-socket.service.ts` al paquete nuevo, reemplazando `signal()` por `BehaviorSubject`/`Observable` de RxJS para `room`, `roomInfo`, `connected`, `joinRejectedReason`, `roomSummary`, `errorMessage`, `myName`
- [x] 2.4 Portar `hasSessionFor`/`rejoinIfNeeded`/`saveSession`/`clearSession` usando el `SessionStore` inyectado en vez de acceder a `sessionStorage` directamente
- [x] 2.5 Escribir tests unitarios del paquete nuevo cubriendo los escenarios de `specs/room-client-runtime/spec.md` (cola de mensajes pendientes, transiciones de estado por tipo de `ServerMessage`, reingreso automático con/sin sesión)

## 3. Adaptar `apps/web`

- [x] 3.1 Implementar `SessionStore` basado en `sessionStorage` dentro de `apps/web` (misma lógica que hoy tiene `room-socket.service.ts`)
- [x] 3.2 Reescribir `RoomSocketService` como adaptador delgado: instancia el cliente de `room-client-runtime` con la config de `environment.wsUrl` y el `SessionStore` de `apps/web`, y envuelve cada `Observable` con `toSignal()` para exponer los mismos signals públicos que hoy (`room`, `roomInfo`, `connected`, `joinRejectedReason`, `roomSummary`, `errorMessage`). `myName` queda como signal writable local (los componentes lo asignan de forma optimista) alimentado también por `client.myName$`.
- [x] 3.3 Verificar que ningún componente de `apps/web` (`pages/home`, `pages/room`, `ui/*`) necesite cambios, ya que la superficie pública de `RoomSocketService` no cambia — confirmado con `nx build web` exitoso sin tocar componentes

## 4. Verificación de regresión

- [x] 4.1 Correr los tests unitarios existentes (`nx run-many --target=test --all`) — `apps/web` no tiene target `test` propio (preexistente, no introducido por este change); la cobertura de `apps/web` es vía e2e (tarea 4.2)
- [x] 4.2 Correr la suite e2e completa (`nx e2e e2e`), en particular los specs de reconexión y moderación de sala, y confirmar que el comportamiento (incluido el bug conocido de reconexión en pestaña nueva) no cambia — 12/13 pasan (1 skipped). El único test que falla intermitentemente (`room-moderation.spec.ts:158`, "participante desconectado...") se confirmó **preexistente y no relacionado**: falla igual (5/5) contra el código original vía `git stash`. Documentado en `openspec/known-issues.md`.
- [x] 4.3 Correr `nx run-many --target=lint --all` y `nx run-many --target=build --all` para confirmar que el workspace completo sigue compilando — build OK en los 4 proyectos; lint falla por `@nx/enforce-module-boundaries` en los archivos nuevos, pero es el mismo error preexistente en todo archivo que importa `shared-contracts` (`apps/web`, `apps/realtime-api`) desde antes de este change, no una regresión introducida
