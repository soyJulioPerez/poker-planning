## Why

Los 93 tests de `realtime-api` (Fase 2.1) mockean el repositorio con `aws-sdk-client-mock` — no prueban que las queries a DynamoDB estén bien armadas. `lib/room-repository.ts` tiene tres funciones (`getRoomMeta`, `getRoomParticipants`, `buildRoomState`) que arman `KeyConditionExpression`, `begins_with` y leen el TTL, y hoy se ejercitan solo a través de mocks en specs de otros archivos — nunca contra una tabla real. Un error en esa expresión pasaría los 93 tests sin que nadie se entere.

Además, con la segunda vuelta de la 2.1 ya completa, la cobertura real de `realtime-api` es alta (86% statements, 76% branches) — es el momento correcto para fijar un umbral trinquete, como anticipaba el roadmap.

## What Changes

- Nuevo `jest.integration.config.cts` en `apps/realtime-api/`, con `testMatch` sobre `*.integration.spec.ts`.
- Segunda entrada de `@nx/jest/plugin` en `nx.json`, apuntando ese config a un target nuevo `test-integration` — `nx test realtime-api` no cambia.
- Tests de integración para `getRoomMeta`, `getRoomParticipants` y `buildRoomState` contra DynamoDB Local real, cubriendo PK/SK, `begins_with`, TTL y una lectura de sala completa.
- Job nuevo en `ci.yml`, en paralelo a `verify` y `e2e`, que levanta DynamoDB Local (reusando `npm run e2e:db:up` de la Fase 1.2) y corre `nx affected -t test-integration`.
- `coverageThreshold` en `jest.config.cts` (el target rápido, no el de integración), fijado en los valores ya alcanzados.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `continuous-integration`: agrega el requisito de que las queries a DynamoDB de `realtime-api` se verifiquen contra una base real, y de que la cobertura de tests no pueda bajar del umbral ya alcanzado.

## Impact

- `apps/realtime-api/jest.integration.config.cts` (nuevo), `apps/realtime-api/jest.config.cts` (gana `coverageThreshold`).
- `apps/realtime-api/src/lib/room-repository.integration.spec.ts` (nuevo).
- `nx.json`: segunda entrada de `@nx/jest/plugin`.
- `.github/workflows/ci.yml`: job nuevo.
- Sin cambios en `lib/room-repository.ts` ni en ningún otro código de aplicación — es infraestructura de testing pura.
- Fuera de alcance: la Fase 2.4 (tests de `room-client-runtime`/`apps/web`), anotada aparte en el roadmap.
