## Why

El backend de `realtime-api` no tiene tracing: no hay forma de ver cuánto tarda cada llamada a DynamoDB o al broadcast dentro de una acción, ni de aislar dónde se va el tiempo en la acción más lenta. Los logs estructurados de la Fase 4.1 ya inyectan un `xray_trace_id` en cada línea, pero X-Ray no está activo — ese ID no lleva a ningún timeline todavía.

## What Changes

- Activar AWS X-Ray (`Tracing: Active`) en las tres funciones Lambda de `realtime-api` (`connect`, `disconnect`, `default`), vía `Globals.Function` en `infra/template.yaml`.
- Instrumentar los clientes de AWS SDK v3 (`DynamoDBDocumentClient` en `lib/dynamo-client.ts`, `ApiGatewayManagementApiClient` en `lib/broadcast.ts`) con AWS Lambda Powertools Tracer (`@aws-lambda-powertools/tracer`), para que cada llamada aparezca como subsegmento con su duración.
- Anotar `roomId` y `action` en el trace de cada invocación de `default` (`tracer.putAnnotation`), para poder filtrar traces por sala igual que hoy se filtran logs.
- Documentar en `docs/aws-observability.md` el alcance real de lo que se puede ver: **el trace arranca en Lambda, no en API Gateway** — API Gateway no soporta X-Ray para WebSocket APIs (solo para REST APIs), confirmado en la documentación oficial de AWS. Cada invocación de Lambda genera su propio trace independiente; no hay un trace único que una `connect` → mensajes de `default` → `disconnect` de una misma sesión.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `observability`: agrega el requisito de que las llamadas a servicios AWS dentro de una acción queden trazadas con X-Ray, con duración visible por subsegmento y filtrable por sala.

## Impact

- `infra/template.yaml`: `Globals.Function.Tracing: Active`.
- `apps/realtime-api/src/lib/dynamo-client.ts` y `apps/realtime-api/src/lib/broadcast.ts`: envolver los clientes con `tracer.captureAWSv3Client()`.
- `apps/realtime-api/src/handlers/default.ts`: anotar `roomId`/`action` en el trace activo.
- `package.json`: nueva dependencia `@aws-lambda-powertools/tracer`.
- `docs/aws-observability.md`: sección de tracing, con la limitación de API Gateway documentada.
- Sin cambios de API pública ni de comportamiento observable por el cliente — es instrumentación pura.
