## MODIFIED Requirements

### Requirement: Reconexión automática
El sistema SHALL identificar a un participante que se reconecta prioritariamente mediante un identificador de sesión persistido (`participantId`) generado y guardado localmente al unirse por primera vez, restaurando su estado (voto actual y posición en la sala) sin requerir que vuelva a unirse manualmente. Cuando no exista ese identificador para la sesión que reconecta (por ejemplo, una sesión guardada antes de que este mecanismo existiera, o un navegador/dispositivo nuevo sin la sesión persistida), el sistema SHALL identificar al participante mediante la combinación de nombre y sala, igual que antes de este mecanismo. Un intento de reconexión que sea rechazado SHALL notificarse a quien lo intenta, en vez de dejarlo en un estado de espera indefinido.

#### Scenario: Participante pierde y recupera conexión con identificador de sesión coincidente
- **WHEN** un participante con voto emitido pierde la conexión WebSocket y luego recarga la página, reconectando con el mismo identificador de sesión persistido
- **THEN** el sistema lo reconoce como el mismo participante y restaura su voto y estado previos, sin importar si el registro previo todavía figura como conectado

#### Scenario: Reconexión sin identificador de sesión coincidente y nombre libre
- **WHEN** un participante reconecta sin un identificador de sesión coincidente (sesión nueva o legacy) y el nombre que usa no figura conectado en ese momento
- **THEN** el sistema lo reconoce como ese participante y restaura su estado previo, igual que el comportamiento previo a este cambio

#### Scenario: Reconexión sin identificador de sesión coincidente y nombre en uso
- **WHEN** un participante reconecta sin un identificador de sesión coincidente y el nombre que usa figura conectado en ese momento
- **THEN** el sistema rechaza la reconexión, igual que rechazaría a cualquier otro intento de unión con un nombre ya en uso

#### Scenario: Reconexión rechazada se notifica en vez de dejar la pantalla cargando
- **WHEN** un intento de reconexión automática es rechazado por cualquier motivo
- **THEN** el sistema lo notifica a quien intenta reconectar y lo redirige a la pantalla de inicio con el código de sala precargado, en vez de dejarlo en un estado de carga indefinido
