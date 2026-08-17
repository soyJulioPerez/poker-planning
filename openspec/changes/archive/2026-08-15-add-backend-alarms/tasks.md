## 1. Template: parámetro, mapping y topic

- [x] 1.1 Agregar `Parameter NotificationEmail` (String) a `infra/template.yaml`.
- [x] 1.2 Agregar `Mappings.AlarmThresholds` (dev/qa/prod) con `LambdaErrorsPerFiveMin` e `IntegrationErrorsPerFiveMin`.
- [x] 1.3 `AWS::SNS::Topic` (`poker-planning-<ambiente>-alerts`) y `AWS::SNS::Subscription` (protocolo `email`, endpoint `!Ref NotificationEmail`).

## 2. Alarmas

- [x] 2.1 Alarma de `Errors` de Lambda: metric math `SUM` de las tres funciones, umbral desde `Mappings.AlarmThresholds`, `Period: 300`, `TreatMissingData: notBreaching`, `AlarmActions` al topic.
- [x] 2.2 Alarma de `Throttles` de Lambda: metric math `SUM` de las tres funciones, umbral literal `0`, mismas propiedades de evaluación.
- [x] 2.3 Alarma de `Duration` p99 de Lambda: metric math `MAX` de los tres p99, umbral literal `5` segundos.
- [x] 2.4 Alarma de `IntegrationError` del WebSocket API (`AWS/ApiGateway`, dimensión `ApiId`), umbral desde `Mappings.AlarmThresholds`.

## 3. Configuración de deploy

- [x] 3.1 `parameter_overrides` de `dev`/`qa`/`prod` en `infra/samconfig.toml` ganan `NotificationEmail=juliolpj@hotmail.com`.
- [x] 3.2 `sam validate --lint`.

## 4. Verificación contra `dev` real

- [x] 4.1 Desplegar a `dev`.
- [x] 4.2 **Pausa manual**: confirmar la suscripción SNS desde el email recibido (no automatizable).
- [x] 4.3 Forzar errores reales en `dev` hasta cruzar el umbral de la alarma de `Errors` (repetir una acción inválida las veces necesarias en la ventana de 5 minutos).
- [x] 4.4 Confirmar con `aws cloudwatch describe-alarms` que la alarma pasó a estado `ALARM`.
- [x] 4.5 Confirmar con el usuario que el email de notificación llegó.

## 5. Documentación

- [x] 5.1 Sección de alarmas en `docs/aws-observability.md`: qué dispara cada una, los umbrales por ambiente, y la evidencia de la verificación en `dev`.
- [x] 5.2 Actualizar `docs/hardening-roadmap.md`: marcar 4.2 hecha.
