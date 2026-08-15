## Context

La Fase 4.1 (`add-backend-structured-logging`) dejó `default.ts` con la garantía de que ningún error del procesamiento de una acción desaparece en silencio — pero esa garantía nunca se extendió a `connect.ts`/`disconnect.ts`, ni cubrió las dos líneas de `default.ts` que corren *antes* de que `request` exista. El hallazgo salió de verificar la Fase 4.2 contra `dev` real: forzar un error en `connect.ts` (invocación directa con un evento sin `requestContext`) produjo un crash crudo de Lambda, no un log JSON de Powertools.

## Goals / Non-Goals

**Goals:**
- Ningún fallo real en `connect.ts`, `disconnect.ts` o las dos líneas iniciales de `default.ts` queda sin un log JSON estructurado con contexto y stack.
- La alarma `lambda-errors` de la Fase 4.2 sigue siendo significativa para estos tres handlers — nada de esto la deja ciega.
- Verificado contra `dev` real, no solo con tests.

**Non-Goals:**
- No se cubre el resto de `default.ts` (el `switch` de acciones) — ya está cubierto desde la Fase 4.1.
- No se introduce ninguna abstracción compartida entre los tres handlers.
- No se toca infraestructura — `Tracing: Active`, las alarmas, los log groups, todo eso ya existe y no cambia.

## Decisions

### 1. Loguear y relanzar, no tragar como `default.ts`

`default.ts` traga las excepciones de su `switch` de acciones porque tiene un `connectionId` conocido y un cliente WebSocket esperando *algún* mensaje de vuelta — silenciar y responder con un `error` es lo correcto ahí. Ninguno de los tres puntos que este change cubre está en esa situación:

- **`connect.ts`**: si el `PutCommand` falla y de todas formas devolvemos 200, el cliente queda "conectado" sin que el backend lo haya registrado — un estado roto y silencioso, peor que rechazar la conexión. Relanzar hace que API Gateway rechace la conexión de verdad.
- **`disconnect.ts`**: quien se desconectó ya se fue, no hay "rechazo" posible — pero relanzar mantiene la alarma honesta sobre fallos reales de limpieza (una conexión que queda huérfana en DynamoDB).
- **Las dos líneas de `default.ts`**: si `connectionId` no se pudo extraer, no hay a quién responderle — tragar el error no tiene ningún beneficio, porque no existe el canal para avisarle a nadie.

En los tres casos, tragar el error apagaría silenciosamente la alarma de la Fase 4.2 para ese handler — el motivo central de esta decisión.

### 2. Tres `try`/`catch` propios, sin abstracción compartida

Los tres handlers comparten la misma línea (`event.requestContext.connectionId`), pero cada uno necesita loguear un evento y un contexto distintos (`connection.open_failed` vs. `connection.close_failed` vs. `action.malformed_event`), y `default.ts` además necesita cubrir una segunda línea (`apiEndpointFromEvent`) que los otros dos no tienen. Una abstracción compartida (ej. un helper `extractConnectionId(event, eventName)`) ahorraría unas pocas líneas a cambio de una capa de indirección para un caso que ya es simple de leer tal cual. Se prefirió mantener cada handler autocontenido, mismo criterio de no introducir abstracciones prematuras que ya rige el resto del proyecto.

### 3. En `disconnect.ts`, un solo `try`/`catch` exterior, no cuatro

En vez de envolver individualmente la extracción de `connectionId`, el `GetCommand`, el `UpdateCommand` y el `DeleteCommand`, un único `try`/`catch` exterior alrededor de todo el cuerpo (con el catch existente del broadcast best-effort anidado adentro, sin tocar) cubre los cuatro puntos con un solo bloque. Cualquier fallo en cualquiera de los cuatro termina en el mismo log (`connection.close_failed`) con el contexto que se haya llegado a conocer hasta ese punto (`connectionId` siempre; `roomId`/`name` si el `GetCommand` ya respondió).

### 4. `default.ts`: un `try`/`catch` separado del de `JSON.parse`, no uno combinado

El `try`/`catch` de `JSON.parse` ya existente loguea `action.invalid_payload` y responde al cliente con un mensaje de error — puede hacerlo porque `connectionId` ya se conoce en ese punto. Combinar ambos casos en un solo `try` mezclaría dos situaciones distintas (evento malformado vs. payload malformado) bajo el mismo manejo, cuando en realidad tienen distinta respuesta posible (una puede avisarle al cliente, la otra no). Se mantienen separados.

### 5. Corrección de `known-issues.md`, no una entrada nueva

El hallazgo ya tiene una entrada (agregada al verificar la Fase 4.2). Se corrige esa entrada para reflejar que las líneas de extracción del contexto del evento son un hueco compartido por los tres handlers — distinguiéndolo explícitamente de las llamadas a DynamoDB de `connect.ts`/`disconnect.ts`, que sí tienen valor real de producción (pueden fallar con tráfico genuino), mientras que la extracción de `connectionId` solo es alcanzable con un evento sintético, nunca con tráfico real de API Gateway.

## Risks / Trade-offs

- **[Riesgo] El caso que más se cubre (`default.ts`, las dos líneas iniciales) es el que menos valor real tiene** — no es alcanzable con tráfico real de API Gateway. Mitigado documentándolo explícitamente así en el diseño y en `known-issues.md`, para que quede claro que el motivo es completar la garantía y corregir lo que se dijo, no cerrar una vulnerabilidad de producción.
- **[Riesgo] Cambiar `connect.ts` de "silencioso" a "relanza"** podría, en teoría, cambiar el comportamiento observable si algo dependía silenciosamente del código anterior — no hay tal dependencia: hoy un fallo ahí *ya* termina en una conexión rechazada (la excepción no capturada se propaga igual), lo único que cambia es que ahora queda logueada antes de terminar.

## Migration Plan

1. `connect.ts`: envolver el cuerpo completo en `try`/`catch`.
2. `disconnect.ts`: agregar el `try`/`catch` exterior, sin tocar el catch del broadcast.
3. `default.ts`: envolver las dos líneas iniciales en su propio `try`/`catch`.
4. `connect.spec.ts` (nuevo), extender `disconnect.spec.ts`, `default.spec.ts` (nuevo, mínimo).
5. `nx test/lint/build realtime-api`.
6. Corregir `docs/known-issues.md`.
7. Desplegar a `dev` y repetir `aws lambda invoke --payload '{}'` contra `ConnectFunction` (la misma prueba que forzó la alarma en la Fase 4.2) — confirmar que esta vez aparece `connection.open_failed` en JSON, no el crash crudo.

Sin plan de rollback especial: es código de aplicación, no infraestructura — un deploy de vuelta revierte el comportamiento sin tocar ningún recurso de AWS.

## Open Questions

Ninguna abierta.
