## 1. Target de integración

- [x] 1.1 Crear `apps/realtime-api/jest.integration.config.cts`, con `testMatch` sobre `*.integration.spec.ts`.
- [x] 1.2 Agregar el target `test-integration` a `apps/realtime-api/project.json` con el executor `nx:run-commands` (`jest --config jest.integration.config.cts`) — no vía `@nx/jest/plugin` ni el executor `@nx/jest:jest` (ver design.md, Decisión 1: los dos caminos originales no eran viables).
- [x] 1.3 Confirmar con `npx nx show project realtime-api --json` que aparecen los dos targets (`test` y `test-integration`) y que `nx test realtime-api` sigue corriendo solo los specs de siempre.

## 2. Tests de integración

- [x] 2.1 Crear `apps/realtime-api/src/lib/room-repository.integration.spec.ts`: cubrir `getRoomMeta`, `getRoomParticipants` y `buildRoomState` contra DynamoDB Local real (requiere `npm run dev:db:up` + `npm run dev:db:create-table` corriendo).
- [x] 2.2 Cada test genera su propio `roomId` único; `crearSalaMeta`/`agregarParticipante` autorregistran lo que crean, y un `afterEach` compartido los limpia — corre incluso si una aserción falla a mitad de camino.
- [x] 2.3 Verificar localmente: `npx nx run realtime-api:test-integration` en verde contra DynamoDB Local (7/7).

## 3. Cobertura con umbral

- [x] 3.1 Agregar `coverageThreshold` a `apps/realtime-api/jest.config.cts` con los valores medidos (Statements 86, Branches 76, Functions 95, Lines 86).
- [x] 3.2 Confirmar verificación activa: subir el umbral a 100% en las cuatro métricas hace fallar `nx test realtime-api --coverage` con el mensaje real de Jest (`"global" coverage threshold for branches (100%) not met: 76.2%`, etc.) — no es una configuración decorativa.
- [x] 3.3 Revertido a los valores reales (86/76/95/86); pasa de nuevo.

## 4. CI

- [x] 4.1 Job nuevo en `.github/workflows/ci.yml`, en paralelo a `verify` y `e2e`, que reusa `npm run e2e:db:up` para levantar DynamoDB Local y corre `nx affected -t test-integration --outputStyle=static`. `deploy-backend` gana `test-integration` en `needs:` (decisión confirmada: sí bloquea el deploy).
- [ ] 4.2 Push a una rama y confirmar en una corrida real de GitHub Actions que el job nuevo aparece, levanta DynamoDB Local, y pasa.

## 5. Documentación

- [x] 5.1 Actualizar `docs/hardening-roadmap.md`: marcar 2.2 y 2.3 hechas, con lo que quedó distinto.
