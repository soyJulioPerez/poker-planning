## Context

`realtime-api` tiene tres Lambdas (`connect`, `disconnect`, `default`) detrás de un WebSocket API (`AWS::ApiGatewayV2::Api`, `ProtocolType: WEBSOCKET`). Desde la Fase 4.1 emiten logs estructurados con AWS Lambda Powertools `Logger`, que ya inyecta `xray_trace_id` en cada línea — pero X-Ray no está activo, así que ese campo no apunta a nada todavía.

**Hallazgo que fija el alcance real de esta fase**: X-Ray no soporta tracing para WebSocket APIs en API Gateway, solo para REST APIs. Confirmado en la documentación oficial de AWS X-Ray (`xray-services-apigateway.html`): *"X-Ray only supports tracing for REST APIs through API Gateway."* Esto invalida la lectura literal del criterio de aceptación original de `docs/hardening-roadmap.md` (*"API Gateway → Lambda → DynamoDB → broadcast"*): API Gateway nunca crea ni propaga un segmento para una API WebSocket, así que ese primer salto no puede aparecer en el trace, sea cual sea la implementación.

## Goals / Non-Goals

**Goals:**
- Cada invocación de Lambda genera un trace de X-Ray con segmento raíz + subsegmentos para cada llamada a DynamoDB y a `ApiGatewayManagementApi` (broadcast).
- El trace de `default` queda anotado con `roomId` y `action`, filtrable en X-Ray igual que los logs se filtran por `roomId` en Logs Insights.
- Documentado y verificado contra `dev` real: se puede identificar dónde se va el tiempo en la acción más lenta.

**Non-Goals:**
- **No** unir en un solo trace la secuencia `connect` → mensajes de `default` → `disconnect` de una misma sesión de usuario. Requeriría propagar manualmente un trace ID propio entre invocaciones independientes de Lambda (X-Ray no tiene esto out-of-the-box para WebSocket) — complejidad no justificada para el valor que aporta, en línea con lo que ya anticipaba el roadmap ("con una sola Lambda el valor es limitado").
- **No** instrumentar el salto API Gateway → Lambda. No es posible con X-Ray para WebSocket APIs (ver Context).
- **No** tocar `apps/web` ni `apps/mobile`. El tracing de cliente (X-Ray o equivalente en el navegador) queda fuera de esta fase.

## Decisions

### 1. AWS Lambda Powertools `Tracer`, no `aws-xray-sdk-core` directo

Mismo criterio que la elección de `Logger` en la Fase 4.1: es la práctica establecida para Lambda+Node, comparte familia con el `Logger` ya instalado, y `tracer.captureAWSv3Client()` envuelve un cliente de AWS SDK v3 en una línea, generando subsegmentos automáticos por cada comando (`GetCommand`, `QueryCommand`, `PostToConnectionCommand`, etc.) sin tocar el código que ya los llama. Usar `aws-xray-sdk-core` pelado exigiría lo mismo con una API menos idiomática y sin la integración con `putAnnotation`/`putMetadata` que ya sigue las convenciones de Powertools.

Alternativa descartada: instrumentación manual con segmentos/subsegmentos hechos a mano — mucho más código para el mismo resultado, sin ninguna ventaja dado que Powertools ya resuelve el caso exacto de "cliente de AWS SDK v3 dentro de un handler de Lambda".

### 2. `Tracing: Active` en `Globals.Function`, no por función

Las tres funciones necesitan tracing por igual — no hay ninguna que deba quedar afuera (a diferencia de, por ejemplo, una función de solo lectura de bajo valor). `Globals.Function` ya centraliza `Runtime`, `MemorySize` y `Timeout`; `Tracing: Active` sigue el mismo patrón y evita que una función nueva se olvide de activarlo.

`Tracing: Active` (vs. `PassThrough`): con `Active`, Lambda decide el muestreo y crea el segmento siempre que no haya una decisión de muestreo previa entrante — que es el caso aquí, porque el WebSocket API nunca manda una. `PassThrough` delegaría la decisión "aguas arriba", pero no hay nada aguas arriba que la tome.

No hace falta agregar `Policies:` para X-Ray: cuando `Tracing: Active` está seteado y la función no define `Role` explícito (no es el caso acá — las tres usan `Policies:`, SAM genera el rol), SAM adjunta automáticamente `AWSXrayWriteOnlyAccess` al rol de ejecución.

### 3. Envolver los clientes en el punto de construcción, no en cada handler

`dynamo-client.ts` y `broadcast.ts` son los únicos dos lugares donde se instancian clientes de AWS SDK (`DynamoDBDocumentClient`, `ApiGatewayManagementApiClient`). Envolver ahí — no en cada handler — cubre las tres funciones (`connect`, `disconnect`, `default`) automáticamente, porque las tres importan de esos mismos módulos. Es el mismo principio que centralizar el logging en la Fase 4.1: un punto de instrumentación, no diez.

### 4. Anotar `roomId`/`action`, no meta-datos arbitrarios

X-Ray distingue *annotations* (indexadas, filtrables por consola/CLI, límite de 50 por trace) de *metadata* (no indexada, solo visible al abrir el trace). `roomId` y `action` son exactamente lo que se necesita filtrar — el mismo par de campos que ya vertebra los logs de la Fase 4.1. Se agregan como annotations en `default.ts`.

**Corrección encontrada al verificar contra `dev` real**: `tracer.putAnnotation()` llamado directo en el handler no anotaba nada — ni un solo trace de `dev` mostraba `roomId`/`action`, solo las annotations automáticas (`aws:responseLatency`, etc.). Causa, confirmada leyendo `ProviderService.putAnnotation()` en el paquete instalado: en un Lambda con `Tracing: Active`, `tracer.getSegment()` devuelve el segmento *facade* que Lambda crea para toda la invocación — y Powertools rechaza anotar ese segmento explícitamente (`"You cannot annotate the main segment in a Lambda execution environment"`, con un `console.warn` silencioso, sin lanzar). Hace falta un subsegmento propio para que la annotation aterrice. `captureAWSv3Client()` no tiene este problema porque adjunta subsegmentos como hijos del segmento activo sea cual sea, sin la misma restricción.

La solución es el patrón de "instrumentación manual" que el propio paquete documenta en el JSDoc de `Tracer` para handlers sin decorator ni Middy: abrir un subsegmento al entrar (`segment.addNewSubsegment(...)`), fijarlo como activo (`tracer.setSegment(...)`), y cerrarlo/restaurar el facade al salir. Se adoptó ese patrón en vez de inventar uno propio — mismo criterio que las decisiones 1 y 3 (usar lo establecido, no lo hecho a mano). El nombre del subsegmento sigue la convención `## <nombre>` que usa el propio decorator de Powertools internamente, aplicada aquí por acción (`## ${request.action}`) en vez de por handler, porque `default.ts` enruta diez acciones distintas y separarlas es lo que hace útil el trace en la consola.

### 5. El criterio de aceptación del roadmap se corrige, no se fuerza

En vez de intentar simular un salto de API Gateway que X-Ray no puede registrar (por ejemplo, con un segmento manual falso), se documenta la limitación como lo que es: una limitación real y verificada de X-Ray sobre WebSocket APIs, no un defecto de esta implementación. `docs/hardening-roadmap.md` se actualiza para reflejarlo, igual que se hizo con otros criterios que "quedaron distintos" en fases anteriores.

## Risks / Trade-offs

- **[Riesgo] Cada invocación es un trace aislado** → mitigado documentando explícitamente esto como límite conocido (Non-Goals), no como bug. Para depurar una sesión completa, se sigue necesitando cruzar por `connectionId`/`roomId` en los logs de la Fase 4.1 — X-Ray complementa, no reemplaza esa vía.
- **[Riesgo] Costo/latencia adicional** → X-Ray tiene una capa gratuita de 100,000 traces/mes; el tráfico de este proyecto (tres ambientes de aprendizaje, sin usuarios reales en volumen) está muy por debajo. La latencia que agrega la instrumentación de Powertools es marginal (microsegundos por subsegmento) frente al `Timeout: 10` configurado.
- **[Riesgo] Confundir "no hay segmento de API Gateway" con "el tracing no funciona"** → mitigado documentando el árbol de segmentos esperado en `docs/aws-observability.md` antes de verificar contra `dev`, para no perder tiempo buscando algo que no puede existir.

## Migration Plan

1. Agregar `@aws-lambda-powertools/tracer` a `package.json`.
2. `Tracing: Active` en `Globals.Function` de `infra/template.yaml`.
3. Crear `apps/realtime-api/src/lib/tracer.ts` (mismo patrón que `lib/logger.ts` de la Fase 4.1).
4. Envolver los clientes en `dynamo-client.ts` y `broadcast.ts` con `tracer.captureAWSv3Client()`.
5. Anotar `roomId`/`action` en `default.ts`.
6. Desplegar a `dev`, generar tráfico real (crear sala, votar, revelar), y verificar con la CLI de X-Ray (`get-trace-summaries` / `batch-get-traces`) que aparecen los traces con los subsegmentos esperados y las annotations filtrables por `roomId`.
7. Documentar en `docs/aws-observability.md`: árbol de segmentos esperado, la limitación de API Gateway/WebSocket, y la consulta de verificación.
8. Actualizar `docs/hardening-roadmap.md`: marcar 4.3 hecha, con el criterio de aceptación corregido a lo verificado.

Sin plan de rollback especial: `Tracing: Active` es una propiedad mutable de `AWS::Serverless::Function` (no fuerza reemplazo), así que un deploy de vuelta a `Tracing: PassThrough` o sin la propiedad revierte el comportamiento sin tocar ningún otro recurso.

## Open Questions

Ninguna abierta — las tres decisiones quedaron cerradas en el explore previo a este proposal.
