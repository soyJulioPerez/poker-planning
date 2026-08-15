## ADDED Requirements

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
