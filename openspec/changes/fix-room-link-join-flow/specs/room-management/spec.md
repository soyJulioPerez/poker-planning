## MODIFIED Requirements

### Requirement: Creación de sala
El sistema SHALL permitir a cualquier usuario crear una sala de Planning Poker sin necesidad de autenticarse, generando un identificador de sala único y un link/código para compartir. El link compartible SHALL ser una URL completa y funcional, respetando la ruta base real de despliegue de la aplicación, de modo que abrirlo directamente (sin haber pasado antes por la pantalla de inicio) navegue correctamente a la sala. Al crear la sala, el moderador SHALL poder elegir opcionalmente un grupo de íconos (ver capability `participant-identity`); si elige uno, SHALL también elegir su propio ícono de ese grupo antes de enviar el formulario. Mientras se espera la respuesta del servidor tras iniciar la creación, el sistema SHALL mostrar un indicador visual de carga y deshabilitar el botón de acción. Si no se recibe respuesta dentro de un tiempo razonable, el sistema SHALL mostrar un mensaje de error y permitir reintentar.

#### Scenario: Usuario crea una sala nueva
- **WHEN** un usuario abre la aplicación y elige "Crear sala"
- **THEN** el sistema genera un `roomId` único, asigna a ese usuario como moderador, y muestra un link/código compartible

#### Scenario: Link compartible es una URL completa y funcional
- **WHEN** el moderador visualiza o copia el link compartible mostrado tras crear la sala
- **THEN** dicho link, al abrirse directamente en un navegador sin sesión previa, resuelve a la ruta de la sala correspondiente

#### Scenario: Indicador de carga mientras se crea la sala
- **WHEN** un usuario envía el formulario de "Crear sala"
- **THEN** el sistema muestra un indicador visual de carga y deshabilita el botón de acción hasta recibir una respuesta

#### Scenario: Sin respuesta del servidor al crear sala
- **WHEN** un usuario envía el formulario de "Crear sala" y no se recibe respuesta dentro del tiempo de espera configurado
- **THEN** el sistema oculta el indicador de carga, muestra un mensaje de error, y permite reintentar el envío

### Requirement: Unión a sala vía link o código
El sistema SHALL permitir que cualquier persona con el link o código de una sala existente se una indicando su nombre, sin autenticación. Si la sala destino tiene un grupo de íconos asignado, el sistema SHALL exigir además la selección de un ícono de ese grupo (ver capability `participant-identity`). La pantalla inicial SHALL mostrar la opción "Unirse a sala" seleccionada por defecto y posicionada primero (a la izquierda) entre las tabs. La tab seleccionada SHALL indicarse mediante un estilo visualmente distinguible de un botón de acción (por ejemplo, una línea inferior de color en vez de un fondo sólido invertido), manteniendo en todo momento contraste suficiente para ser legible. Mientras se espera la respuesta del servidor tras enviar la solicitud de unión, el sistema SHALL mostrar un indicador visual de carga y deshabilitar el botón de acción. Si no se recibe respuesta dentro de un tiempo razonable, el sistema SHALL mostrar un mensaje de error y permitir reintentar.

Cuando un usuario abre directamente la URL de una sala (`/room/<roomId>`) sin tener una sesión previa registrada para esa sala, el sistema SHALL redirigirlo automáticamente a la pantalla de inicio con la tab "Unirse a sala" activa y el campo "Código de sala" precargado con el `roomId` de la URL, en vez de dejarlo en un estado de carga indefinido.

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

#### Scenario: Acceso directo a una sala sin sesión previa redirige a Home con el código precargado
- **WHEN** un usuario abre la URL `/room/<roomId>` directamente (por ejemplo, desde un link compartido) sin tener una sesión guardada para esa sala
- **THEN** el sistema lo redirige a la pantalla de inicio, con la tab "Unirse a sala" activa y el campo "Código de sala" ya completado con `<roomId>`

#### Scenario: Acceso a una sala con sesión previa no redirige
- **WHEN** un usuario abre la URL `/room/<roomId>` y ya tiene una sesión guardada para esa sala (por ejemplo, tras recargar la página estando ya dentro)
- **THEN** el sistema intenta reconectarlo automáticamente a la sala, sin redirigirlo a la pantalla de inicio
