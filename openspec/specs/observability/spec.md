# observability Specification

## Purpose
TBD - created by archiving change add-backend-structured-logging. Update Purpose after archive.
## Requirements
### Requirement: El backend emite sus logs como JSON estructurado

Los tres handlers de `realtime-api` (`connect`, `disconnect`, `default`) SHALL emitir cada entrada de log como un objeto JSON de una línea, no como texto libre. CloudWatch Logs Insights puede consultar campos de un JSON; no puede consultar texto libre de forma estructurada.

#### Scenario: Una conexión nueva se registra en JSON
- **WHEN** un cliente abre una conexión WebSocket
- **THEN** el handler `connect` emite un log en formato JSON con al menos el `connectionId`

#### Scenario: Una acción se registra en JSON
- **WHEN** el handler `default` procesa cualquier acción del cliente
- **THEN** emite al menos un log en formato JSON correspondiente a esa acción

### Requirement: Cada log de una acción permite reconstruir la sesión de una sala

Todo log emitido por el procesamiento de una acción SHALL incluir el nombre de la acción y, cuando exista, el `roomId` de la sala involucrada — incluida la acción de creación, donde el `roomId` no llega en el mensaje del cliente sino que se genera durante el procesamiento.

#### Scenario: Crear una sala deja su `roomId` en el log
- **WHEN** se procesa una acción `createRoom`
- **THEN** el log de finalización de esa acción incluye el `roomId` recién generado

#### Scenario: Una acción sobre una sala existente queda asociada a ella
- **WHEN** se procesa cualquier acción distinta de `createRoom` sobre una sala existente
- **THEN** los logs de esa acción incluyen el `roomId` de la sala

### Requirement: Ningún error de una acción desaparece en silencio

Cuando el procesamiento de una acción lance una excepción no controlada, el sistema SHALL registrar un log de error con el mensaje, el stack completo, y el contexto de la acción (`connectionId`, `action`, `roomId` si corresponde) — antes de responder al cliente.

#### Scenario: Una excepción durante una acción queda registrada con su stack
- **WHEN** el procesamiento de una acción lanza una excepción no controlada
- **THEN** se emite un log de error que incluye el mensaje y el stack de la excepción, junto con el `connectionId` y la `action`

#### Scenario: Un fallo del broadcast al desconectar no queda mudo
- **WHEN** falla el intento best-effort de notificar a la sala que un participante se desconectó
- **THEN** el fallo se registra como advertencia, con el error, sin impedir que la limpieza de la conexión continúe

### Requirement: La actividad de una sala se puede reconstruir sin leer código

El sistema SHALL contar con una consulta de CloudWatch Logs Insights, documentada y verificada contra un ambiente real, capaz de responder qué ocurrió en una sala específica dentro de una ventana de tiempo dada.

#### Scenario: Reconstruir la actividad reciente de una sala
- **WHEN** alguien necesita saber qué pasó en una sala en los últimos minutos
- **THEN** existe una consulta documentada que, dado un `roomId` y una ventana de tiempo, devuelve la secuencia de acciones registradas para esa sala, sin necesidad de leer el código fuente

### Requirement: Los logs no se retienen indefinidamente

Cada log group de `realtime-api` SHALL tener una retención finita, configurada explícitamente. Ningún log group SHALL depender del valor por defecto de CloudWatch, que es retención infinita.

La retención SHALL diferir por ambiente: los ambientes de desarrollo y prueba retienen sus logs por menos tiempo que producción, siguiendo el mismo criterio que separa los umbrales de alarma por ambiente.

#### Scenario: Un log group tiene retención configurada
- **WHEN** se inspecciona cualquiera de los log groups de las tres funciones de `realtime-api`, en cualquier ambiente
- **THEN** su retención es un número finito de días, nunca "nunca expira"

#### Scenario: La retención de producción es mayor que la de desarrollo
- **WHEN** se comparan las retenciones configuradas de `dev` y de `prod`
- **THEN** la de `prod` es mayor o igual, nunca menor

### Requirement: El ciclo de vida de un log group no depende del ciclo de vida de la función

El log group de cada función SHALL ser un recurso gestionado por la infraestructura como código, con un nombre que no dependa del identificador físico de la función. Un reemplazo de la función —forzado por un cambio en una propiedad inmutable— SHALL NOT dejar su log group anterior sin gestión.

#### Scenario: Reemplazar una función no abandona su log group
- **WHEN** una función se reemplaza por un cambio en una propiedad que fuerza reemplazo
- **THEN** el log group que usaba antes del reemplazo sigue siendo un recurso gestionado por la infraestructura como código, no uno huérfano

#### Scenario: El nombre del log group se puede predecir sin consultar el stack
- **WHEN** alguien necesita encontrar el log group de una función en un ambiente dado
- **THEN** puede construir su nombre a partir del nombre del ambiente y de la función, sin necesidad de consultar los recursos físicos del stack

### Requirement: Las llamadas a servicios AWS dentro de una acción quedan trazadas con X-Ray

Cada invocación de las Lambdas de `realtime-api` (`connect`, `disconnect`, `default`) SHALL generar un trace de AWS X-Ray cuyo segmento raíz sea la invocación misma, con un subsegmento por cada llamada saliente a un servicio de AWS (DynamoDB, API Gateway Management API) realizada durante esa invocación, incluida su duración individual.

Esto no incluye el salto entrante desde API Gateway: X-Ray no soporta tracing para WebSocket APIs en API Gateway, solo para REST APIs. El segmento raíz del trace es la propia invocación de Lambda, no un segmento de API Gateway.

#### Scenario: Procesar una acción deja ver el tiempo de cada llamada a AWS
- **WHEN** el handler `default` procesa una acción que hace una o más llamadas a DynamoDB
- **THEN** el trace de esa invocación incluye un subsegmento por cada llamada, con su duración

#### Scenario: Un broadcast queda visible en el trace
- **WHEN** el procesamiento de una acción dispara un broadcast a otros participantes de la sala
- **THEN** el trace incluye un subsegmento por cada llamada a la API Gateway Management API involucrada en ese broadcast

### Requirement: El trace de una acción se puede filtrar por sala

El trace generado al procesar una acción en el handler `default` SHALL incluir, como annotations indexadas, el `roomId` de la sala involucrada (cuando exista) y el nombre de la acción, para poder ubicar los traces de una sala específica sin inspeccionar cada uno manualmente.

#### Scenario: Buscar los traces de una sala específica
- **WHEN** se necesita encontrar los traces correspondientes a una sala determinada
- **THEN** existe una annotation de `roomId` en cada trace que permite filtrarlos por ese valor, de forma análoga a como se filtran los logs

### Requirement: Un error o degradación real del backend dispara una notificación

El sistema SHALL enviar una notificación por email cuando ocurra cualquiera de: la tasa de errores combinada de las Lambdas de `realtime-api` supere el umbral del ambiente en una ventana de 5 minutos, ocurra al menos un throttle de Lambda, la duración p99 combinada de las Lambdas supere el umbral configurado, o la tasa de `IntegrationError` del WebSocket API supere el umbral del ambiente.

#### Scenario: Errores de Lambda por encima del umbral notifican
- **WHEN** la cantidad de errores combinados de las tres Lambdas en una ventana de 5 minutos supera el umbral configurado para el ambiente
- **THEN** se dispara una alarma que notifica por email

#### Scenario: Un throttle de Lambda notifica
- **WHEN** ocurre al menos un throttle en cualquiera de las tres Lambdas
- **THEN** se dispara una alarma que notifica por email

#### Scenario: Duración p99 por encima del umbral notifica
- **WHEN** el p99 de duración de la Lambda más lenta de las tres supera el umbral configurado
- **THEN** se dispara una alarma que notifica por email

#### Scenario: Errores de integración del WebSocket API notifican
- **WHEN** la cantidad de `IntegrationError` del WebSocket API en una ventana de 5 minutos supera el umbral configurado para el ambiente
- **THEN** se dispara una alarma que notifica por email

### Requirement: El umbral de errores no genera ruido desproporcionado por ambiente

El umbral de errores (tanto de Lambda como de `IntegrationError`) SHALL configurarse independientemente por ambiente, siguiendo el mismo criterio que ya separa la retención de logs por ambiente: el umbral de `prod` SHALL ser igual o más estricto que el de `dev`/`qa`, nunca más permisivo.

#### Scenario: El umbral de producción es igual o más estricto que el de desarrollo
- **WHEN** se comparan los umbrales de error configurados de `dev` y de `prod`
- **THEN** el de `prod` es igual o menor, nunca mayor

### Requirement: Ningún error de conexión o evento malformado desaparece en silencio

Cuando falle la apertura de una conexión WebSocket, el cierre de una conexión, o cuando un evento no traiga el contexto mínimo esperado (`requestContext`) en cualquiera de los tres handlers de `realtime-api`, el sistema SHALL registrar un log de error con el contexto disponible y el stack completo, antes de que la invocación termine en error.

Esta garantía es independiente de la que cubre el procesamiento de las 10 acciones del dominio (`### Requirement: Ningún error de una acción desaparece en silencio`): esa se limita a lo que ocurre una vez que una acción válida empezó a procesarse, y no cubre la apertura/cierre de conexión ni un evento cuyo contexto no se pudo interpretar.

#### Scenario: Un fallo real al abrir una conexión queda registrado
- **WHEN** el handler `connect` no puede completar el registro de una conexión nueva por un error real (no un evento malformado)
- **THEN** se registra un log de error con el `connectionId` y el stack completo, y la conexión se rechaza

#### Scenario: Un fallo real al cerrar una conexión queda registrado
- **WHEN** el handler `disconnect` no puede completar la limpieza de una conexión por un error real
- **THEN** se registra un log de error con el contexto disponible (`connectionId`, y `roomId` si ya se conoce) y el stack completo

#### Scenario: Un evento sin el contexto mínimo esperado queda registrado
- **WHEN** cualquiera de los tres handlers recibe un evento del que no se puede extraer el contexto mínimo (`requestContext`)
- **THEN** se registra un log de error con el error y el stack completo, antes de que la invocación termine en error
