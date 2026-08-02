## ADDED Requirements

### Requirement: Runtime independiente de framework de UI
El paquete `room-client-runtime` SHALL no depender de Angular ni de ninguna API exclusiva del navegador (ej. `sessionStorage`, `window`) en su código de producción, de forma que pueda ser consumido por cualquier app cliente (web actual u otra futura) sin arrastrar esas dependencias.

#### Scenario: El paquete se compila sin Angular
- **WHEN** se compila `packages/room-client-runtime` de forma aislada (sin las dependencias de `apps/web`)
- **THEN** la compilación no requiere `@angular/core` ni ningún otro paquete de Angular

#### Scenario: Persistencia de sesión inyectada, no hardcodeada
- **WHEN** se instancia el cliente del runtime
- **THEN** recibe una implementación de `SessionStore` (get/save/clear) como parámetro, en vez de acceder directamente a `sessionStorage`

### Requirement: Gestión de conexión WebSocket con reintento de mensajes pendientes
El runtime SHALL abrir y mantener una conexión WebSocket hacia la URL de configuración recibida, y SHALL encolar cualquier `ClientRequest` enviado mientras la conexión no esté abierta, despachándolo apenas la conexión se establezca.

#### Scenario: Envío mientras el socket no está abierto
- **WHEN** se llama a `send(request)` y el socket no está en estado `OPEN`
- **THEN** el runtime abre (o reutiliza) la conexión y el mensaje se envía en cuanto el socket pasa a `OPEN`, en el mismo orden en que fue encolado

#### Scenario: Envío con socket ya abierto
- **WHEN** se llama a `send(request)` y el socket está en estado `OPEN`
- **THEN** el mensaje se envía inmediatamente, sin pasar por la cola de pendientes

### Requirement: Estado de sala expuesto como Observables de RxJS
El runtime SHALL exponer el estado de sala (`room`, `roomInfo`, `connected`, `joinRejectedReason`, `roomSummary`, `errorMessage`) como `Observable` de RxJS derivados de los `ServerMessage` recibidos, en vez de un tipo reactivo específico de un framework de UI.

#### Scenario: `roomState` actualiza el estado de sala
- **WHEN** el runtime recibe un `ServerMessage` de tipo `roomState`
- **THEN** el `Observable` de `room` emite la sala recibida y el de `joinRejectedReason` emite `null`

#### Scenario: `joinRejected` no pisa el estado de sala
- **WHEN** el runtime recibe un `ServerMessage` de tipo `joinRejected`
- **THEN** el `Observable` de `joinRejectedReason` emite el motivo recibido, sin modificar el último valor emitido de `room`

#### Scenario: `roomClosed` limpia la sesión persistida
- **WHEN** el runtime recibe un `ServerMessage` de tipo `roomClosed`
- **THEN** el `Observable` de `roomSummary` emite el resumen recibido y se invoca `clear()` sobre el `SessionStore` inyectado

### Requirement: Nombre propio expuesto como estado reactivo
El runtime SHALL exponer el nombre con el que el usuario actual participa (`myName`) como `Observable`, actualizado al guardar una sesión nueva o al reingresar a una sala con sesión existente. Este `Observable` es la fuente para el reingreso automático; una app consumidora puede además asignar el nombre de forma optimista por su cuenta (ej. antes de que el servidor confirme una sala nueva) sin pasar por el runtime.

#### Scenario: Guardar una sesión actualiza el nombre propio
- **WHEN** se invoca `saveSession(roomId, name)`
- **THEN** el `Observable` de `myName` emite `name` y se invoca `save(roomId, name)` sobre el `SessionStore` inyectado

#### Scenario: Reingreso actualiza el nombre propio
- **WHEN** el runtime reingresa automáticamente a una sala usando una sesión guardada
- **THEN** el `Observable` de `myName` emite el `name` de esa sesión antes de enviar el `ClientRequest` de `joinRoom`

### Requirement: Reingreso automático a una sala con sesión guardada
El runtime SHALL permitir reingresar automáticamente a una sala cuando exista una sesión guardada para ese `roomId` en el `SessionStore` inyectado, sin reintentarlo si ya hay estado de sala cargado.

#### Scenario: Reingreso con sesión existente
- **WHEN** se invoca el reingreso para un `roomId` que tiene una sesión guardada en el `SessionStore` y todavía no hay `room` cargado
- **THEN** el runtime se conecta y envía un `ClientRequest` de tipo `joinRoom` con el `roomId` y `name` de la sesión guardada

#### Scenario: No reingresa si ya hay estado de sala
- **WHEN** se invoca el reingreso para un `roomId` y el `Observable` de `room` ya tiene un valor cargado
- **THEN** el runtime no envía ningún `ClientRequest` adicional

#### Scenario: No reingresa sin sesión guardada
- **WHEN** se invoca el reingreso para un `roomId` sin sesión guardada en el `SessionStore`
- **THEN** el runtime no se conecta ni envía ningún `ClientRequest`
