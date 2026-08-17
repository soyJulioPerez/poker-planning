## Context

`realtime-api` no tiene ninguna alarma. Las Fases 4.1 (logs estructurados) y 4.3 (tracing) dan las herramientas para diagnosticar *después* de enterarse de un problema — pero nada avisa que hay que mirar. Esta fase cierra ese hueco: notificación proactiva, no diagnóstico.

Los tres ambientes (`dev`/`qa`/`prod`) ya son stacks de CloudFormation separados (`infra/samconfig.toml`), así que "las alarmas se crean por ambiente" es gratis — cada stack tiene sus propios recursos, sin nada compartido entre ambientes.

## Goals / Non-Goals

**Goals:**
- Una alarma real, verificada disparando de verdad en `dev`, no solo declarada.
- Umbrales distintos donde tiene sentido (errores), iguales donde no (throttles, duración) — no inventar variación donde el roadmap no la pide.
- Reusar los mecanismos de configuración que ya existen en el repo (`Mappings` para valores estructurales, `parameter_overrides` para valores de deploy), sin agregar uno nuevo.

**Non-Goals:**
- No se agregan alarmas por función individual. Con logs y tracing ya cubriendo el diagnóstico fino, una alarma agregada que avise "algo se rompió en alguna de las tres" es suficiente — quién exactamente se responde mirando los logs, no agregando más alarmas.
- No se agregan dashboards de CloudWatch. Fuera del alcance de "avisar que algo pasó".
- No se resuelve rotación de guardia, escalamiento, ni integración con un sistema de incidentes — un email a una sola persona es lo que el proyecto necesita hoy.

## Decisions

### 1. `IntegrationError`, no una métrica "5xx"

Confirmado contra la documentación oficial de AWS (misma verificación que en la Fase 4.3 para X-Ray): las WebSocket APIs de API Gateway no exponen una métrica "5xx" como las REST/HTTP APIs. Exponen `IntegrationError` (4XX/5XX devueltos por la integración, es decir, por la Lambda), `ClientError` (4XX de API Gateway antes de llegar a la integración) y `ExecutionError` (fallos al invocar la integración). `IntegrationError` es el equivalente funcional más cercano a "5xx de la API" que pedía el roadmap originalmente.

### 2. Alarmas agregadas por metric math, no una por función

Alarmar cada métrica (`Errors`, `Throttles`, `Duration` p99) por cada una de las tres funciones da 9 recursos de alarma. Se optó por 3 alarmas — una por tipo de métrica — que combinan las tres funciones con **metric math** (`AWS::CloudWatch::Alarm.Metrics`, en vez de la forma simple `MetricName`/`Dimensions` que solo admite una función a la vez):

- **Errors** y **Throttles**: `SUM` de las tres — sumar conteos de eventos discretos es correcto matemáticamente y responde "¿pasó esto en alguna de las tres?".
- **Duration p99**: `MAX` de los tres p99 — promediar percentiles entre funciones no tiene sentido estadístico, pero el máximo sí: "¿la más lenta de las tres está por encima del umbral?".

Trade-off aceptado: una alarma en ALARM no dice *cuál* función rompió sin mirar los logs de la Fase 4.1 — aceptable porque esa consulta ya existe y tarda segundos.

### 3. `NotificationEmail` como `Parameter`, no `Mappings` ni SSM

El email no es un valor estructural del diseño (no varía por ambiente en este caso, y aunque variara, no describe "cómo está armado el sistema"), es un dato de "quién recibe el aviso al desplegar esta instancia" — mismo rol que ya cumple `Environment`. Va como `Parameter` inyectado vía `parameter_overrides` en `infra/samconfig.toml`, committed a git: es el patrón que este repo ya usa para exactamente este tipo de valor, y el email no es secreto. SSM Parameter Store quedó descartado por ahora — resuelve un problema que no existe todavía (poder cambiar el contacto sin un deploy), a costa de un recurso de infraestructura nuevo.

### 4. Umbrales: `Mappings` solo donde varían, constantes donde no

`Mappings.AlarmThresholds` (al lado de `Mappings.LogRetention`) solo para lo que realmente cambia por ambiente:

| Ambiente | Errors / 5 min | IntegrationError / 5 min |
|---|---|---|
| `dev` | > 3 | > 3 |
| `qa` | > 3 | > 3 |
| `prod` | > 1 | > 1 |

`Throttles > 0` y `Duration p99 > 5s` son iguales en los tres ambientes — van como literales directo en el recurso de la alarma, no en `Mappings`. Meter un valor que no varía en una tabla indexada por ambiente sería una tabla que siempre devuelve lo mismo — complejidad sin motivo.

El umbral de `IntegrationError` no estaba cerrado en el explore. Se decidió aplicarle el mismo patrón que `Errors` de Lambda (misma tabla, mismos números) porque conceptualmente son la misma señal vista desde dos lados (la Lambda falla → la integración de API Gateway lo refleja) — no hay motivo para que difieran. Ajustable si en la verificación real resulta ruidoso.

### 5. `TreatMissingData: notBreaching` en las cuatro alarmas

Tráfico bajo (app de aprendizaje, tres ambientes sin usuarios reales en volumen): es esperable que un período de 5 minutos no tenga ninguna invocación, sobre todo en `qa`. Sin este flag, CloudWatch podría marcar la alarma en `INSUFFICIENT_DATA` y generar ruido que no refleja un problema real. `notBreaching` trata la falta de datos como "todo bien", consistente con que ausencia de tráfico no es un incidente.

### 6. Un topic SNS por ambiente, no uno compartido

Cada ambiente ya es un stack de CloudFormation independiente sin recursos compartidos entre sí (mismo criterio que ya aplica a las tablas de DynamoDB, los log groups, etc.). Un topic por stack sigue ese patrón — evita una referencia cross-stack que no existe hoy en el repo para nada más.

## Risks / Trade-offs

- **[Riesgo] La confirmación de la suscripción SNS es un paso manual, fuera de IaC** → el deploy no falla si no se confirma, pero las notificaciones no se entregan hasta que se hace. Mitigado documentando el paso explícitamente en `tasks.md` y no intentando forzar el error de verificación hasta confirmar la suscripción a mano.
- **[Riesgo] Una alarma agregada no identifica qué función falló** → mitigado por diseño (Non-Goals): los logs de la Fase 4.1 responden esa pregunta en segundos, agregar alarmas por función no aporta nada que no exista ya.
- **[Riesgo] El umbral de `IntegrationError` es una suposición, no un número pedido explícitamente** → documentado como tal en la Decisión 4; se ajusta si la verificación en `dev` muestra que dispara de más o de menos.

## Migration Plan

1. `Parameter NotificationEmail` + `Mappings.AlarmThresholds` en `infra/template.yaml`.
2. `AWS::SNS::Topic` + `AWS::SNS::Subscription` (protocolo email) por stack.
3. Las 4 alarmas (`Errors`, `Throttles`, `Duration` p99, `IntegrationError`), todas con `AlarmActions: [!Ref AlertsTopic]`.
4. `parameter_overrides` de los tres ambientes en `infra/samconfig.toml` gana `NotificationEmail=juliolpj@hotmail.com`.
5. `sam validate --lint`.
6. Desplegar a `dev`.
7. **Pausa manual**: confirmar la suscripción SNS desde el email recibido — no se puede automatizar.
8. Forzar un error real en `dev` (repetir una acción inválida las veces necesarias para cruzar el umbral) y confirmar que la alarma pasa a `ALARM` (`aws cloudwatch describe-alarms`) y que llega el email.
9. Documentar en `docs/aws-observability.md`.

Sin plan de rollback especial: los recursos nuevos (`Parameter`, `Mappings`, `AWS::SNS::Topic/Subscription`, `AWS::CloudWatch::Alarm`) no reemplazan ni tocan ningún recurso existente — un deploy de vuelta sin ellos los elimina limpio.

## Open Questions

Ninguna abierta — el umbral de `IntegrationError` quedó resuelto como decisión (4), no como pregunta pendiente.
