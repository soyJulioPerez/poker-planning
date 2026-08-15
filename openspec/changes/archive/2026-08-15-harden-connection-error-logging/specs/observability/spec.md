## ADDED Requirements

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
