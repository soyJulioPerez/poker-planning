## MODIFIED Requirements

### Requirement: Reingreso automático a una sala con sesión guardada
El runtime SHALL permitir reingresar automáticamente a una sala cuando exista una sesión guardada para ese `roomId` en el `SessionStore` inyectado, sin reintentarlo si ya hay estado de sala cargado. El `ClientRequest` de `joinRoom` enviado SHALL incluir el `participantId` persistido en la sesión guardada, además de `roomId` y `name`.

#### Scenario: Reingreso con sesión existente
- **WHEN** se invoca el reingreso para un `roomId` que tiene una sesión guardada en el `SessionStore` y todavía no hay `room` cargado
- **THEN** el runtime se conecta y envía un `ClientRequest` de tipo `joinRoom` con el `roomId`, `name` y `participantId` de la sesión guardada

#### Scenario: No reingresa si ya hay estado de sala
- **WHEN** se invoca el reingreso para un `roomId` y el `Observable` de `room` ya tiene un valor cargado
- **THEN** el runtime no envía ningún `ClientRequest` adicional

#### Scenario: No reingresa sin sesión guardada
- **WHEN** se invoca el reingreso para un `roomId` sin sesión guardada en el `SessionStore`
- **THEN** el runtime no se conecta ni envía ningún `ClientRequest`

## ADDED Requirements

### Requirement: Identificador de sesión persistido por participante
El runtime SHALL exponer una forma de generar un identificador de sesión único (`participantId`), para que la app consumidora lo incluya en el pedido inicial de `createRoom`/`joinRoom` antes de que exista una sesión guardada. El runtime SHALL persistir el `participantId` recibido junto con `roomId` y `name` al guardar una sesión, y SHALL incluirlo en todo `ClientRequest` de tipo `joinRoom` que envíe para esa sesión en un reingreso posterior.

#### Scenario: Se persiste el identificador recibido al guardar una sesión
- **WHEN** se invoca `saveSession(roomId, name, participantId)`
- **THEN** el runtime persiste ese `participantId` junto con `roomId` y `name` en el `SessionStore` inyectado

#### Scenario: El identificador se reutiliza en reingresos posteriores
- **WHEN** el runtime reingresa automáticamente a una sala usando una sesión guardada
- **THEN** el `ClientRequest` de `joinRoom` enviado incluye el mismo `participantId` que quedó persistido para esa sesión

### Requirement: Reconexión automática tras pérdida de conexión
El runtime SHALL reintentar automáticamente la conexión WebSocket cuando esta se cierre y exista una sesión guardada activa para la sala actual, con backoff creciente entre intentos, reenviando el `ClientRequest` de `joinRoom` correspondiente en cada intento. El runtime SHALL exponer el estado de conexión (`connected`) para que una app consumidora pueda reflejar visualmente que está reintentando.

#### Scenario: El socket se cierra con una sesión activa
- **WHEN** la conexión WebSocket se cierra y hay una sesión guardada para la sala en la que el runtime estaba participando
- **THEN** el runtime programa un reintento de conexión y, al reconectar, reenvía el `ClientRequest` de `joinRoom` con los datos de esa sesión

#### Scenario: El socket se cierra sin sesión activa
- **WHEN** la conexión WebSocket se cierra y no hay ninguna sesión guardada asociada a la sala en la que el runtime estaba participando
- **THEN** el runtime no programa ningún reintento de conexión

#### Scenario: Los reintentos usan backoff creciente
- **WHEN** ocurren varios cierres de conexión consecutivos mientras hay una sesión activa
- **THEN** el tiempo de espera entre cada intento de reconexión aumenta respecto al intento anterior, hasta un tope máximo

### Requirement: Logging de desarrollo del ciclo de vida de la conexión
El runtime SHALL registrar en la consola los eventos principales del ciclo de vida de la conexión WebSocket — intento de conexión, conexión establecida, conexión cerrada, reintento programado, reingreso enviado, reingreso aceptado y reingreso rechazado — sin depender de ningún servicio externo de telemetría ni enviar esos registros a un backend.

#### Scenario: Se registra un cierre de conexión
- **WHEN** la conexión WebSocket se cierra
- **THEN** el runtime emite un registro en la consola indicando el cierre

#### Scenario: Se registra un reintento de reconexión
- **WHEN** el runtime programa un reintento de conexión tras un cierre
- **THEN** el runtime emite un registro en la consola indicando que va a reintentar
