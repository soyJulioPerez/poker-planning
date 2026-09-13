## 1. Template

- [x] 1.1 Agregar `Parameter AlarmsEnabled` (`'true'`/`'false'`, default `'false'`) a `infra/template.yaml`.
- [x] 1.2 Agregar `Condition: AlarmsEnabled` (`!Equals [!Ref AlarmsEnabled, 'true']`).
- [x] 1.3 Aplicar `Condition: AlarmsEnabled` a `AlertsTopic`, `AlertsSubscription`, `LambdaErrorsAlarm`, `LambdaThrottlesAlarm`, `LambdaDurationP99Alarm`, `ApiGatewayIntegrationErrorAlarm`.

## 2. Configuración de deploy

- [x] 2.1 `AlarmsEnabled=false` en `parameter_overrides` de `dev`/`qa`/`prod` en `infra/samconfig.toml`.
- [x] 2.2 `sam validate --lint`.

## 3. Aplicar en AWS

- [ ] 3.1 `sam build`.
- [ ] 3.2 `sam deploy --config-env dev`, `--config-env qa`, `--config-env prod`.
- [ ] 3.3 Confirmar con `aws cloudwatch describe-alarms` y `aws sns list-topics` que no queda ningún recurso de alarma/topic de `poker-planning-*` en ningún ambiente.

## 4. Documentación

- [x] 4.1 Actualizar la sección "Alarmas" de `docs/aws-observability.md` para documentar el flag y que está apagado por defecto en los 3 ambientes.
