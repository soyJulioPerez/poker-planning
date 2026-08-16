## Why

`sam deploy` termina en verde cuando CloudFormation aplica el changeset — eso confirma que la infraestructura se actualizó, no que la API funciona. Un endpoint completamente roto puede desplegarse sin que nada quede en rojo. La Fase 6.1 del [hardening roadmap](../../../docs/hardening-roadmap.md) pide un chequeo funcional real después del deploy.

## What Changes

- Nuevo target `realtime-api:smoke-test`: conecta por WebSocket contra el endpoint recién desplegado, crea una sala, une un segundo participante, vota, revela — usando `RoomClient` (`room-client-runtime`) reusado tal cual, no un cliente WS escrito de cero.
- Corre **solo contra `prod`**, no contra `qa` — en los dos lugares donde el deploy a prod realmente ocurre: el job `deploy-backend` de `ci.yml` (automático, acotado a `github.ref == 'refs/heads/master'`) y `deploy-backend.yml` (manual, acotado a `environment == 'prod'`).
- Limpieza explícita vía `DeleteCommand` directo a DynamoDB (mismo patrón de `roomKey`/`participantKey` que ya usan los tests de integración) — `closeRoom` no borra los datos que crea, solo emite un broadcast, y el TTL (4 horas) es demasiado largo para depender de él.
- Si el smoke test falla: el job queda en rojo, **sin rollback automático**, pero imprime la instrucción exacta de rollback manual (con el tag anterior ya calculado, no un placeholder) y las últimas líneas `level=ERROR` del log group del handler `default` — para no tener que salir de la corrida de CI a buscar dónde arrancar a investigar.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `backend-deployment`: se agregan requirements sobre verificación funcional post-deploy, limpieza de los datos de prueba, y diagnóstico en caso de falla (sin cambiar el requirement de rollback ya existente, que se reusa tal cual).

## Impact

- `apps/realtime-api/project.json` (target `smoke-test` nuevo)
- `apps/realtime-api/scripts/smoke-test.mjs` (nuevo)
- `.github/workflows/ci.yml` (paso nuevo en el job `deploy-backend`)
- `.github/workflows/deploy-backend.yml` (paso nuevo)
- `infra/template.yaml`: posible ajuste de permisos IAM del rol de deploy para leer CloudWatch Logs (`logs:FilterLogEvents`) — a confirmar, el rol se provisiona fuera de este repo
- `docs/hardening-roadmap.md` (cierre de la Fase 6.1)
- No afecta código de aplicación (`apps/realtime-api/src`, `apps/web`) — es tooling de verificación, no un cambio de comportamiento
