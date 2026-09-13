## Context

Las 4 alarmas de CloudWatch de `add-backend-alarms` están vivas en los 3 stacks desde el 2026-08-15. Cada alarma tiene un costo mensual fijo independiente de si dispara o no. El proyecto no tiene tráfico real hoy y el costo no se justifica, pero el diseño de `add-backend-alarms/design.md` (umbrales por ambiente, agregación por metric math, topic SNS) sigue siendo válido para cuando vuelva a hacer falta.

## Decisions

### 1. Flag de CloudFormation, no borrar los recursos

Se descarta borrar directamente las alarmas y el topic del template: reactivarlas más adelante implicaría reescribir los 6 recursos desde cero y volver a decidir umbrales y agregaciones ya resueltos. Un `Parameter` + `Condition` deja el trabajo hecho, apagado por default, reversible cambiando un solo valor.

### 2. Un solo flag para los 6 recursos, no uno por alarma

Las 4 alarmas comparten el mismo topic SNS como único `AlarmActions`. Flags independientes permitirían combinaciones sin sentido operativo (alarmas activas sin topic de destino, o un topic sin ninguna alarma que le escriba). Un flag único trata el subsistema completo — topic, suscripción, 4 alarmas — como una unidad atómica.

### 3. Default `'false'`, explícito además en `samconfig.toml`

El `Default: 'false'` del parámetro ya alcanza para que un stack nuevo nazca sin alarmas. Se agrega igual `AlarmsEnabled=false` a `parameter_overrides` en los 3 ambientes existentes, mismo criterio que ya se usa para `NotificationEmail` y `Environment`: el valor efectivo de cada stack queda visible en `samconfig.toml` sin tener que ir a leer el default en `template.yaml`.

## Risks / Trade-offs

- **[Riesgo] Ningún ambiente notifica errores o degradaciones mientras el flag esté apagado** → aceptado a propósito: es el punto del cambio. Los logs estructurados (Fase 4.1) y el tracing (Fase 4.3) siguen disponibles para diagnóstico manual.
- **[Riesgo] `NotificationEmail` sigue siendo un parámetro obligatorio aunque no se use con el flag apagado** → no se toca en este change: sacarle el requisito de valor (agregarle `Default: ''`) es un cambio aparte, sin relación con el costo que motiva este change.

## Migration Plan

1. `Parameter AlarmsEnabled` + `Condition AlarmsEnabled` en `infra/template.yaml`.
2. `Condition: AlarmsEnabled` en `AlertsTopic`, `AlertsSubscription`, `LambdaErrorsAlarm`, `LambdaThrottlesAlarm`, `LambdaDurationP99Alarm`, `ApiGatewayIntegrationErrorAlarm`.
3. `AlarmsEnabled=false` en `parameter_overrides` de los 3 ambientes en `infra/samconfig.toml`.
4. `sam build` + `sam deploy --config-env {dev,qa,prod}` para aplicar el flag en los 3 stacks y eliminar los recursos ya desplegados.
5. Confirmar con `aws cloudwatch describe-alarms` y `aws sns list-topics` que no queda ningún recurso `poker-planning-*-alerts` / `poker-planning-*-lambda-*` / `poker-planning-*-apigw-*` en ningún ambiente.
6. Documentar el flag en `docs/aws-observability.md`.

Sin plan de rollback especial: reactivar es `AlarmsEnabled=true` en el ambiente que corresponda y volver a desplegar — CloudFormation recrea los 6 recursos con la misma definición que ya existe en el template.

## Open Questions

Ninguna.
