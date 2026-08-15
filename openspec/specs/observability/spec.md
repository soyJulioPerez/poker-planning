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
