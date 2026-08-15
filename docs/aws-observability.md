# Observabilidad del backend

Cómo leer los logs del backend en producción, y cómo reconstruir qué pasó en una sala sin leer código.

## Qué queda registrado

Los tres Lambdas (`connect`, `disconnect`, `default`) emiten logs estructurados con [AWS Lambda Powertools](https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger/) — JSON de una línea, no texto libre. `default.ts` es el que enruta las 10 acciones del dominio, y centraliza tres eventos:

| Evento | Cuándo | Campos propios |
|---|---|---|
| `action.received` | al llegar el mensaje, antes de procesarlo | `connectionId`, `action`, `roomId` (si el mensaje lo trae) |
| `action.done` | al terminar sin excepción | + `durationMs` |
| `action.failed` | si algo lanza una excepción no controlada | + `durationMs`, `error` (nombre, mensaje, **stack completo**) |

`connect.ts` emite `connection.open`; `disconnect.ts` emite `connection.close` y, si el broadcast best-effort al desconectar falla, `connection.broadcast_failed` — sin interrumpir la limpieza de la conexión, pero sin desaparecer en silencio.

**Caso especial: `createRoom`.** El mensaje del cliente no trae `roomId` —la sala no existe todavía—. El `roomId` que aparece en su log de `action.done` es el que `handleCreateRoom` generó durante el procesamiento, no uno que vino en el request.

## Reconstruir la actividad de una sala

En **CloudWatch → Logs Insights**, eligiendo el log group de la función `default` del ambiente que corresponda (`/aws/lambda/poker-planning-<ambiente>-default`):

```
fields @timestamp, level, message, action, connectionId, durationMs, error.message, error.stack
| filter roomId = "<CÓDIGO DE SALA>"
| sort @timestamp asc
```

Devuelve, en orden, cada acción procesada sobre esa sala: quién la pidió (`connectionId`), cuánto tardó, y si algo falló, el error completo. Es la consulta que responde *"¿qué pasó en la sala ABC123 hace 20 minutos?"* sin abrir el código.

**Verificado en `dev`** el 2026-08-14: se creó una sala, se le asignó una historia y se forzó un voto con un valor inválido a propósito. La query devolvió las cuatro entradas en orden —creación, asignación, intento de voto, y el error `ValidationException: ExpressionAttributeValues must not be empty` con su stack completo—.

### Cuando no se tiene el código de la sala

Esta query asume que ya tenés un `roomId` —alguien lo reportó, o lo viste en la UI—. Si lo que tenés es solo una ventana de tiempo (por ejemplo, la de una alarma que disparó sin indicar qué sala), hace falta una query previa, sin filtrar por sala, sobre los tres log groups (`connect`, `disconnect`, `default`) a la vez:

```
fields @timestamp, level, message, action, roomId, connectionId, error.message, @message
| filter level = "ERROR" or @message like /Invoke Error/
| sort @timestamp desc
```

El `@message like /Invoke Error/` cubre un caso que `level = "ERROR"` solo no encuentra: un crash sin capturar en `connect.ts`/`disconnect.ts` no genera un log JSON de Powertools (sin campo `level`), sino el formato crudo con el que Lambda reporta una excepción no controlada. Ver [known-issues.md](known-issues.md#connectts-y-disconnectts-pueden-crashear-sin-dejar-un-log-estructurado).

## Encontrar el log group correcto

El nombre es predecible desde el change `add-log-retention` (2026-08-15): cada función tiene su `AWS::Logs::LogGroup` declarado como recurso propio del stack, con nombre fijo — no atado al ID físico de la función, que sí cambia entre deploys que fuerzan un reemplazo.

```
/aws/lambda/poker-planning-<ambiente>-connect
/aws/lambda/poker-planning-<ambiente>-disconnect
/aws/lambda/poker-planning-<ambiente>-default
```

No hace falta `describe-stack-resource` para armarlo. Esto también es lo que evita que un reemplazo de función deje el log group huérfano: al ser un recurso del stack con nombre fijo, sobrevive al reemplazo — la función nueva sigue escribiendo ahí.

**En Git Bash de Windows**, anteponer `MSYS_NO_PATHCONV=1` a cualquier comando de `aws` cuyo argumento empiece con `/` (como `--log-group-name-prefix "/aws/lambda/..."`): sin eso, Git Bash reescribe la ruta como si fuera del sistema de archivos y el comando falla con `InvalidParameterException`.

## Retención

Cada log group tiene una retención finita, diferenciada por ambiente — antes de este change, ninguno la tenía (`retentionInDays: None`, el default de CloudWatch, que es no expirar nunca):

| Ambiente | Retención |
|---|---|
| `dev` | 7 días |
| `qa` | 7 días |
| `prod` | 14 días |

Configurada vía `Mappings.LogRetention` en `infra/template.yaml`, indexado por el parámetro `Environment`.

**Verificado en los tres ambientes** el 2026-08-15: se desplegó, se confirmó que las funciones escriben en el log group nuevo (no en el auto-generado que usaban antes), y que la retención quedó aplicada. Los log groups auto-generados que quedaron huérfanos con esta transición se trataron distinto según el ambiente: en `dev` y `qa` se borraron directo (contenido descartable, `qa` no tenía ninguno); en `prod` —que tenía tráfico real— se les fijó la misma retención de 14 días en vez de borrarlos, para que expiren solos sin perder de golpe el historial reciente.

## Tracing con X-Ray

Las tres Lambdas tienen `Tracing: Active` (`infra/template.yaml`, `Globals.Function`) y usan [AWS Lambda Powertools Tracer](https://docs.powertools.aws.dev/lambda/typescript/latest/core/tracer/) para instrumentar las llamadas salientes a AWS. Árbol de segmentos esperado, por invocación:

```
poker-planning-<ambiente>-<funcion>     (segmento raiz, la invocacion de Lambda)
└── ## <accion>                         (subsegmento propio, solo en "default"; anotado con action + roomId)
    ├── DynamoDB                        (una por cada llamada al repositorio)
    └── ApiGatewayManagementApi         (una por cada mensaje de broadcast)
```

**Límite real, no un defecto de esta implementación**: X-Ray no soporta tracing para WebSocket APIs en API Gateway, solo para REST APIs ([doc oficial](https://docs.aws.amazon.com/xray/latest/devguide/xray-services-apigateway.html): *"X-Ray only supports tracing for REST APIs through API Gateway"*). El segmento raíz de cada trace es la invocación de Lambda — nunca hay un segmento de API Gateway antes. Verificado contra `dev`: en ningún trace de los generados aparece un `origin` distinto de `AWS::Lambda`/`AWS::Lambda::Function` como entrada.

Consecuencia directa: cada invocación (`connect`, cada mensaje que procesa `default`, `disconnect`) es un **trace independiente**. No hay un trace único que una la sesión completa de un usuario — para eso, seguir usando los logs de la sección anterior, cruzando por `connectionId`/`roomId`.

### Buscar los traces de una sala

`default.ts` anota `action` y `roomId` (cuando existe) en el subsegmento de la acción — no en el segmento raíz, porque Powertools rechaza anotar el segmento *facade* que Lambda crea para la invocación completa. Filtrable por CLI:

```bash
aws xray get-trace-summaries \
  --start-time <epoch inicio> --end-time <epoch fin> \
  --filter-expression 'annotation.roomId = "<CÓDIGO DE SALA>"'
```

Cada resultado es un `Id` de trace; el detalle completo (segmentos, subsegmentos, duración de cada uno) se obtiene con:

```bash
aws xray batch-get-traces --trace-ids <id1> <id2> ...
```

(máximo 5 IDs por llamada).

**Verificado en `dev`** el 2026-08-15: se generó una sesión completa (crear sala, unirse, votar, revelar, cerrar) contra un endpoint real. Aparecieron 6 traces —uno por acción procesada por `default`—, todos filtrables por el `roomId` de la sala de prueba. El trace de `reveal` mostró el subsegmento `## reveal` (1.06s) con dos pares DynamoDB+`ApiGatewayManagementApi` (el broadcast a los dos participantes) y varias llamadas más a DynamoDB, cada una con su duración individual — suficiente para identificar dónde se va el tiempo sin instrumentación adicional.

## Alarmas

Cuatro alarmas de CloudWatch por ambiente, todas notificando al mismo topic SNS (`poker-planning-<ambiente>-alerts`), con una suscripción por email (`NotificationEmail`, parámetro de CloudFormation inyectado vía `parameter_overrides` en `infra/samconfig.toml`).

| Alarma | Qué mide | Cómo agrega | Umbral |
|---|---|---|---|
| `poker-planning-<ambiente>-lambda-errors` | `Errors` de `connect`+`disconnect`+`default` | `SUM` (metric math) | dev/qa: > 3 en 5 min · prod: > 1 en 5 min |
| `poker-planning-<ambiente>-lambda-throttles` | `Throttles` de las tres funciones | `SUM` (metric math) | > 0 en cualquier ambiente |
| `poker-planning-<ambiente>-lambda-duration-p99` | `Duration` p99 de las tres funciones | `MAX` (metric math) | > 5s en cualquier ambiente |
| `poker-planning-<ambiente>-apigw-integration-errors` | `IntegrationError` del WebSocket API | Métrica única (`AWS/ApiGateway`, dimensión `ApiId`) | dev/qa: > 3 en 5 min · prod: > 1 en 5 min |

**Por qué agregadas y no una alarma por función**: con los logs (Fase 4.1) y el tracing (Fase 4.3) ya cubriendo el diagnóstico fino, una alarma agregada alcanza para avisar que hay que mirar — cuál de las tres funciones fue se responde en segundos con la query de Logs Insights de más arriba. `SUM` para conteos de eventos discretos (`Errors`, `Throttles`); `MAX` para `Duration` p99, porque promediar percentiles entre funciones no tiene sentido estadístico pero el máximo sí ("la más lenta de las tres").

**`IntegrationError`, no "5xx"**: las WebSocket APIs de API Gateway no exponen una métrica "5xx" como las REST/HTTP APIs — mismo tipo de limitación que la de X-Ray con WebSocket (ver arriba). `IntegrationError` (4XX/5XX devueltos por la integración, es decir, por la Lambda) es el equivalente funcional más cercano.

Los umbrales que varían por ambiente están en `Mappings.AlarmThresholds` de `infra/template.yaml`, al lado de `Mappings.LogRetention`.

### Confirmar la suscripción SNS

Tras el primer deploy, SNS manda un email a `NotificationEmail` con un link de confirmación — sin ese click, ninguna notificación se entrega, aunque las alarmas disparen igual (`aws cloudwatch describe-alarms` las muestra en `ALARM` de todas formas). Verificable por CLI:

```bash
aws sns list-subscriptions-by-topic --topic-arn <arn del topic>
```

`SubscriptionArn: "PendingConfirmation"` significa que falta el click; un ARN real confirma que ya quedó activa.

### Forzar una alarma de verdad

`connect.ts` y `disconnect.ts` no envuelven su lógica en `try`/`catch` (a diferencia de `default.ts`, que desde la Fase 4.1 nunca deja escapar una excepción sin capturarla) — un fallo real ahí sí se propaga sin atrapar y cuenta como `Errors` de Lambda. Invocar la función directamente con un evento sin `requestContext` dispara ese path de forma controlada, sin tocar el WebSocket real:

```bash
aws lambda invoke --function-name <ConnectFunction físico> \
  --payload '{}' --cli-binary-format raw-in-base64-out out.json
```

Devuelve `"FunctionError": "Unhandled"` — cuenta para `AWS/Lambda` `Errors` de esa función. Repetido las veces necesarias para superar el umbral de la ventana de 5 minutos.

**Verificado en `dev`** el 2026-08-15: se confirmó la suscripción SNS, se invocó `ConnectFunction` cuatro veces con un evento vacío (4 > el umbral de 3 de `dev`), `poker-planning-dev-lambda-errors` pasó a estado `ALARM` (`aws cloudwatch describe-alarms`, `StateReason: "Threshold Crossed: 1 datapoint [4.0] was greater than the threshold (3.0)"`), y el email de notificación llegó a destino.

**Los cuatro errores forzados quedaron invisibles para la query de la sección anterior**: `connect.ts` no tiene `try`/`catch`, así que este crash específico ocurrió antes del primer `logger.info` y nunca generó un log JSON de Powertools — Lambda lo registró en su propio formato de texto plano, que `filter level = "ERROR"` no encuentra. Ver el detalle en [known-issues.md](known-issues.md#connectts-y-disconnectts-pueden-crashear-sin-dejar-un-log-estructurado).

## Qué falta

Nada pendiente de la Fase 4 (Observabilidad) — 4.1, 4.2 y 4.3 completas.
