## 1. Dependencia e infraestructura

- [x] 1.1 Agregar `@aws-lambda-powertools/tracer` a `package.json`.
- [x] 1.2 `Tracing: Active` en `Globals.Function` de `infra/template.yaml`.
- [x] 1.3 `sam validate --lint` para confirmar que el template sigue siendo válido.

## 2. Instrumentación

- [x] 2.1 Crear `apps/realtime-api/src/lib/tracer.ts` (mismo patrón que `lib/logger.ts`), exportando una instancia de `Tracer` con `serviceName: 'realtime-api'`.
- [x] 2.2 Envolver el `DynamoDBClient` de `lib/dynamo-client.ts` con `tracer.captureAWSv3Client()`.
- [x] 2.3 Envolver el `ApiGatewayManagementApiClient` de `lib/broadcast.ts` con `tracer.captureAWSv3Client()`.
- [x] 2.4 En `handlers/default.ts`, anotar `roomId` y `action` en el trace activo (`tracer.putAnnotation`) en el mismo punto donde se loguea `action.received`.

## 3. Verificación contra `dev` real

- [x] 3.1 Desplegar el cambio a `dev`.
- [x] 3.2 Generar tráfico real: crear una sala, unirse, votar, revelar.
- [x] 3.3 Consultar X-Ray por CLI (`aws xray get-trace-summaries`, `aws xray batch-get-traces`) y confirmar que aparecen traces con subsegmentos de DynamoDB y de la API Gateway Management API, con duración.
- [x] 3.4 Confirmar que las annotations `roomId`/`action` permiten filtrar los traces de la sala de prueba.
- [x] 3.5 Confirmar que el segmento raíz de cada trace es la invocación de Lambda, no un segmento de API Gateway — documentar esto como comportamiento esperado, no como falla.

## 4. Documentación

- [x] 4.1 Sección de tracing en `docs/aws-observability.md`: árbol de segmentos esperado, la limitación de X-Ray con WebSocket APIs, y la consulta de verificación usada en el paso 3.3.
- [x] 4.2 Actualizar `docs/hardening-roadmap.md`: marcar 4.3 hecha, con nota de qué quedó distinto del criterio de aceptación original (el salto de API Gateway no es alcanzable) y evidencia de la verificación en `dev`.
