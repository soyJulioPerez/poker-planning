## Why

Las alarmas de CloudWatch (`add-backend-alarms`, Fase 4.2) están desplegadas y activas en `dev`, `qa` y `prod` desde su primer deploy: 4 alarmas × 3 stacks = 12 recursos, cada uno con un costo mensual fijo aunque nunca dispare. Es un costo real que hoy nadie necesita pagar en ningún ambiente.

## What Changes

- Nuevo parámetro de CloudFormation `AlarmsEnabled` (`'true'`/`'false'`, default `'false'`) en `infra/template.yaml`.
- Nueva `Condition: AlarmsEnabled`, aplicada a los 6 recursos del subsistema de alarmas: el topic SNS (`AlertsTopic`), la suscripción por email (`AlertsSubscription`) y las 4 `AWS::CloudWatch::Alarm`. Con el flag en `'false'`, CloudFormation no crea esos recursos — o los elimina, si ya existían en el stack.
- `infra/samconfig.toml`: `AlarmsEnabled=false` explícito en `parameter_overrides` de los 3 ambientes (dev, qa, prod) — mismo valor que el default del parámetro, pero visible sin tener que abrir `template.yaml`.
- Deploy a los 3 stacks para eliminar las alarmas y el topic ya desplegados y cortar el cobro.

## Capabilities

### Modified Capabilities
- `observability`: la notificación por email ante error o degradación pasa a depender de un flag, apagado por defecto en los 3 ambientes, en vez de estar siempre activa.

## Impact

- `infra/template.yaml`
- `infra/samconfig.toml`
- `docs/aws-observability.md`
- Ningún cambio en `apps/realtime-api` — igual que en `add-backend-alarms`, esto es infraestructura pura.
