## 1. `BrowserSessionStore`

- [x] 1.1 Crear `apps/web/src/app/core/room-session-store.spec.ts`: instanciar `BrowserSessionStore` directo, sin `TestBed`.
- [x] 1.2 Test: `save(roomId, name)` seguido de `get(roomId)` devuelve `{ roomId, name }`.
- [x] 1.3 Test: `get(otroRoomId)` con una sesión guardada para `roomId` distinto devuelve `null`.
- [x] 1.4 Test: `get(roomId)` sin nada guardado en `sessionStorage` devuelve `null`.
- [x] 1.5 Test: `clear()` seguido de `get(roomId)` devuelve `null`.
- [x] 1.6 Limpiar `sessionStorage` en un `afterEach` para no dejar estado entre tests.

## 2. Regresión `room.ts` / `home.ts`

- [x] 2.1 Crear un fake mínimo de `RoomSocketService` para los tests (método `hasSessionFor` configurable por test; el resto de sus signals con valores neutros) — ver `design.md`, Decisión 1.
- [x] 2.2 Crear `apps/web/src/app/pages/room/room.spec.ts`: `TestBed` con `RoomPage`, `provideRouter`, y el fake de `RoomSocketService` provisto vía `providers`.
- [x] 2.3 Test: con `hasSessionFor` devolviendo `false`, al crear el componente con un `roomId` en la ruta, el router navega a `/` con `queryParams: { room: roomId }` (el fix del bug de "Link directo a una sala").
- [x] 2.4 Test: con `hasSessionFor` devolviendo `true`, el componente NO navega y en cambio invoca `rejoinIfNeeded(roomId)` del servicio.
- [x] 2.5 Crear `apps/web/src/app/pages/home/home.spec.ts`: `TestBed` con `Home`, `provideRouter`, y el fake de `RoomSocketService`.
- [x] 2.6 Test: al crear el componente con `?room=<código>` en la query, `mode` queda en `'join'` y `joinRoomId` queda precargado con el código en mayúsculas.
- [x] 2.7 Test: sin `?room=` en la query, `joinRoomId` queda vacío (no rompe el flujo normal de "crear sala").

## 3. Umbral de cobertura de `apps/web`

- [x] 3.1 Correr `nx test web --coverage` después de agregar los tests de las secciones 1 y 2, y anotar los cuatro números (statements/branches/functions/lines). → Statements 38.64%, Branches 48%, Functions 26.35%, Lines 43.44%.
- [x] 3.2 Agregar `coverage: true` y `coverageThresholds` al target `test` de `apps/web/project.json`, con los números medidos (redondeando levemente hacia abajo si hace falta) — ver `design.md`, Decisión 3. → 38/47/26/43.
- [x] 3.3 Confirmar que `nx test web --coverage` sigue en verde con el umbral puesto.
- [x] 3.4 Confirmar que bajar artificialmente la cobertura (comentar un test) hace fallar la tarea, y revertir el cambio de prueba. → probado con `room-session-store.spec.ts` (skip de sus 4 tests hizo fallar los 4 umbrales); el intento inicial con `room.spec.ts` no sirvió como prueba porque saltear sus tests sube la cobertura global en vez de bajarla (efecto de que `compileComponents()` deja de instrumentar el árbol de componentes hijos) — anotado como hallazgo, no bloquea nada.

## 4. Documentación

- [x] 4.1 `docs/hardening-roadmap.md`: cerrar la subsección 2.4, marcar sus checkboxes, agregar el bloque `> **Hecha** el <fecha>, change \`add-web-client-tests\`. ...` con los números de cobertura reales, siguiendo el estilo de las fases ya cerradas.
- [x] 4.2 `docs/hardening-roadmap.md`: actualizar la fila de la Fase 2 en la tabla "Estado" a "✅ Completa".

## 5. Verificación local

- [x] 5.1 `npx nx affected -t lint test build --base=develop` (o el equivalente que corresponda) para confirmar que no se rompió nada fuera de `apps/web`. → verde (`web`, `e2e`); en el camino se encontraron y corrigieron 3 errores de lint (`no-empty-function`) en `fake-room-socket-service.ts`.

## 6. Pull request

- [ ] 6.1 `git fetch origin && git rebase origin/develop` antes de abrir el PR.
- [ ] 6.2 Abrir PR contra `develop` con `gh pr create`, mensaje en Conventional Commits.
