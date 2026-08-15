## Why

Si `prod` se rompe hoy, nadie se entera hasta que alguien mire los logs a mano. `realtime-api` no tiene ninguna alarma: ni de errores de Lambda, ni de throttles, ni de fallos en la entrada del WebSocket. Los logs (Fase 4.1) y el tracing (Fase 4.3) sirven para diagnosticar después de enterarse — no avisan que algo pasó.

## What Changes

- Un topic SNS por ambiente (`dev`/`qa`/`prod`, cada uno ya es un stack separado), con una suscripción por email.
- Tres alarmas de CloudWatch, cada una agregando las tres Lambdas (`connect`, `disconnect`, `default`) con metric math en vez de una alarma por función:
  - **Errores de Lambda** (`SUM` de `Errors` de las tres funciones) — umbral distinto por ambiente.
  - **Throttles de Lambda** (`SUM` de `Throttles` de las tres funciones) — cualquier throttle es una alarma, no varía por ambiente.
  - **Duración p99 de Lambda** (`MAX` del p99 de `Duration` de las tres funciones) — no varía por ambiente.
- Una alarma sobre `IntegrationError` del WebSocket API — el equivalente funcional a "errores 5xx" para una API Gateway WebSocket, que no tiene una métrica "5xx" (no soportada; ver `design.md`).
- Nuevo parámetro CloudFormation `NotificationEmail`, inyectado vía `parameter_overrides` en `infra/samconfig.toml` (mismo mecanismo que `Environment` hoy).
- Umbrales que varían por ambiente van a `Mappings.AlarmThresholds` en `infra/template.yaml`, al lado del `Mappings.LogRetention` ya existente.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `observability`: agrega el requisito de que un error o degradación real dispare una notificación, sin depender de que alguien mire los logs o los traces por su cuenta.

## Impact

- `infra/template.yaml`: nuevo `Parameter` (`NotificationEmail`), nuevo `Mappings.AlarmThresholds`, recursos `AWS::SNS::Topic`, `AWS::SNS::Subscription`, y 4 `AWS::CloudWatch::Alarm` (3 de Lambda + 1 de API Gateway).
- `infra/samconfig.toml`: `parameter_overrides` de los tres ambientes gana `NotificationEmail=juliolpj@hotmail.com`.
- `docs/aws-observability.md`: sección de alarmas — qué dispara cada una, los umbrales, y cómo se verificó que suenan de verdad.
- Ningún cambio en `apps/realtime-api` — esto es infraestructura pura, no toca código de aplicación.
- Acción manual fuera de IaC: confirmar la suscripción SNS por email (AWS manda un link de confirmación) antes de que las notificaciones puedan entregarse — no es automatizable.
