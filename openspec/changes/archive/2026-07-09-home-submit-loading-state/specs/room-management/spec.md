## MODIFIED Requirements

### Requirement: Creación de sala
El sistema SHALL permitir a cualquier usuario crear una sala de Planning Poker sin necesidad de autenticarse, generando un identificador de sala único y un link/código para compartir. Mientras se espera la respuesta del servidor tras iniciar la creación, el sistema SHALL mostrar un indicador visual de carga y deshabilitar el botón de acción. Si no se recibe respuesta dentro de un tiempo razonable, el sistema SHALL mostrar un mensaje de error y permitir reintentar.

#### Scenario: Usuario crea una sala nueva
- **WHEN** un usuario abre la aplicación y elige "Crear sala"
- **THEN** el sistema genera un `roomId` único, asigna a ese usuario como moderador, y muestra un link/código compartible

#### Scenario: Indicador de carga mientras se crea la sala
- **WHEN** un usuario envía el formulario de "Crear sala"
- **THEN** el sistema muestra un indicador visual de carga y deshabilita el botón de acción hasta recibir una respuesta

#### Scenario: Sin respuesta del servidor al crear sala
- **WHEN** un usuario envía el formulario de "Crear sala" y no se recibe respuesta dentro del tiempo de espera configurado
- **THEN** el sistema oculta el indicador de carga, muestra un mensaje de error, y permite reintentar el envío

### Requirement: Unión a sala vía link o código
El sistema SHALL permitir que cualquier persona con el link o código de una sala existente se una indicando únicamente su nombre, sin autenticación. La pantalla inicial SHALL mostrar la opción "Unirse a sala" seleccionada por defecto y posicionada primero (a la izquierda) entre las tabs. La tab seleccionada SHALL indicarse mediante un estilo visualmente distinguible de un botón de acción (por ejemplo, una línea inferior de color en vez de un fondo sólido invertido), manteniendo en todo momento contraste suficiente para ser legible. Mientras se espera la respuesta del servidor tras enviar la solicitud de unión, el sistema SHALL mostrar un indicador visual de carga y deshabilitar el botón de acción. Si no se recibe respuesta dentro de un tiempo razonable, el sistema SHALL mostrar un mensaje de error y permitir reintentar.

#### Scenario: Participante se une con nombre disponible
- **WHEN** un usuario abre el link/código de una sala activa e ingresa un nombre no utilizado por otro participante conectado en esa sala
- **THEN** el sistema lo agrega a la sala como participante y notifica en vivo a los demás participantes

#### Scenario: Nombre ya en uso por un participante conectado
- **WHEN** un usuario intenta unirse a una sala con un nombre que ya pertenece a otro participante actualmente conectado en esa sala
- **THEN** el sistema rechaza la unión e indica que el nombre ya está en uso en esa sala

#### Scenario: Pantalla inicial muestra "Unirse a sala" por defecto
- **WHEN** un usuario abre la pantalla inicial de la aplicación
- **THEN** el sistema muestra la tab "Unirse a sala" seleccionada por defecto, con su formulario visible, y ubicada a la izquierda de "Crear sala"

#### Scenario: Texto de la tab seleccionada es legible
- **WHEN** un usuario visualiza la pantalla inicial con cualquiera de las dos tabs ("Crear sala" o "Unirse a sala") seleccionada
- **THEN** el texto de la tab seleccionada se distingue claramente de su fondo

#### Scenario: Tab seleccionada no se confunde con un botón de acción
- **WHEN** un usuario visualiza la pantalla inicial con una tab seleccionada
- **THEN** el estilo de la tab activa se distingue del estilo usado por los botones de acción del formulario (por ejemplo, "Crear sala" o "Unirse")

#### Scenario: Indicador de carga mientras se envía la solicitud de unión
- **WHEN** un usuario envía el formulario de "Unirse a sala"
- **THEN** el sistema muestra un indicador visual de carga y deshabilita el botón de acción hasta recibir una respuesta

#### Scenario: Rechazo de unión apaga el indicador de carga
- **WHEN** el sistema rechaza la solicitud de unión (nombre en uso o sala no encontrada)
- **THEN** el sistema oculta el indicador de carga y muestra el mensaje de rechazo correspondiente

#### Scenario: Sin respuesta del servidor al unirse
- **WHEN** un usuario envía el formulario de "Unirse a sala" y no se recibe respuesta dentro del tiempo de espera configurado
- **THEN** el sistema oculta el indicador de carga, muestra un mensaje de error, y permite reintentar el envío
