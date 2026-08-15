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

En **CloudWatch → Logs Insights**, eligiendo el log group de la función `default` del ambiente que corresponda (`/aws/lambda/poker-planning-<ambiente>-DefaultFunction-*`):

```
fields @timestamp, level, message, action, connectionId, durationMs, error.message, error.stack
| filter roomId = "<CÓDIGO DE SALA>"
| sort @timestamp asc
```

Devuelve, en orden, cada acción procesada sobre esa sala: quién la pidió (`connectionId`), cuánto tardó, y si algo falló, el error completo. Es la consulta que responde *"¿qué pasó en la sala ABC123 hace 20 minutos?"* sin abrir el código.

**Verificado en `dev`** el 2026-08-14: se creó una sala, se le asignó una historia y se forzó un voto con un valor inválido a propósito. La query devolvió las cuatro entradas en orden —creación, asignación, intento de voto, y el error `ValidationException: ExpressionAttributeValues must not be empty` con su stack completo—.

## Encontrar el log group correcto

El nombre físico de cada función lleva un sufijo que cambia entre deploys. Para no adivinarlo:

```bash
aws cloudformation describe-stack-resource \
  --stack-name poker-planning-<ambiente> \
  --logical-resource-id DefaultFunction \
  --query "StackResourceDetail.PhysicalResourceId" --output text \
  --region us-east-2
```

**En Git Bash de Windows**, anteponer `MSYS_NO_PATHCONV=1` a cualquier comando de `aws` cuyo argumento empiece con `/` (como `--log-group-name-prefix "/aws/lambda/..."`): sin eso, Git Bash reescribe la ruta como si fuera del sistema de archivos y el comando falla con `InvalidParameterException`.

## Qué falta

- **Alarmas** (Fase 4.2): hoy nada avisa proactivamente si aparece un `action.failed`. Hay que mirar los logs a mano.
- **Tracing distribuido** (Fase 4.3): Powertools ya agrega `xray_trace_id` a cada log, pero X-Ray no está activo (`Tracing: Active` no está en el template de SAM), así que ese ID no lleva a ningún timeline todavía.
