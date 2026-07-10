# Room Management

## Purpose

TBD

## Requirements

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

### Requirement: Rol de moderador único
El sistema SHALL asignar el rol de moderador exclusivamente a quien creó la sala, sin permitir transferencia ni co-moderación, y SHALL mostrar una indicación visual (ícono) de dicho rol a todos los participantes.

#### Scenario: Ícono de moderador visible
- **WHEN** un participante visualiza la lista de personas en la sala
- **THEN** el sistema muestra un ícono distintivo junto al nombre del moderador

#### Scenario: Un participante no moderador intenta ejecutar una acción de moderación
- **WHEN** un participante que no es el moderador intenta revelar votos, resolver la historia o iniciar una nueva ronda
- **THEN** el sistema rechaza la acción

### Requirement: Moderador como votante opcional
El sistema SHALL permitir que el moderador decida si participa como votante o no, y SHALL permitir cambiar esa decisión únicamente cuando no haya una ronda de votación activa. El control para cambiar esta condición SHALL ubicarse junto al nombre del moderador en la lista de participantes, visible para todos los participantes, pero interactivo únicamente para el propio moderador.

#### Scenario: Moderador activa su participación como votante entre rondas
- **WHEN** el moderador cambia la opción de "votar" estando la ronda en estado inactivo (sin votación en curso)
- **THEN** el sistema aplica el cambio y el moderador podrá votar en la siguiente ronda

#### Scenario: Intento de cambio durante ronda activa
- **WHEN** el moderador intenta cambiar su condición de votante mientras hay una votación en curso
- **THEN** el sistema rechaza el cambio y mantiene la condición vigente para la ronda actual

#### Scenario: Otros participantes ven el estado sin poder modificarlo
- **WHEN** un participante que no es el moderador visualiza la lista de participantes
- **THEN** el sistema muestra el control de "el moderador vota" junto al nombre del moderador, en estado deshabilitado para ese participante

#### Scenario: Moderador ve el control deshabilitado durante una ronda activa
- **WHEN** el propio moderador visualiza la lista de participantes mientras hay una votación en curso
- **THEN** el sistema muestra el control deshabilitado, impidiendo su interacción hasta que la ronda finalice

### Requirement: Lista de participantes en vivo
El sistema SHALL mantener y actualizar en tiempo real, para todos los miembros de la sala, la lista de participantes conectados. Para cada participante habilitado como votante, la lista SHALL indicar visualmente si ya emitió su voto (ícono ✓ junto al texto) o si está pendiente de votar (ícono ⏳ junto al texto).

#### Scenario: Nuevo participante se une
- **WHEN** un participante se une exitosamente a la sala
- **THEN** todos los demás participantes ven su nombre agregado a la lista sin necesidad de recargar la página

#### Scenario: Participante aún no ha votado
- **WHEN** un participante habilitado como votante todavía no emitió su voto en la ronda actual
- **THEN** el sistema muestra junto a su nombre el ícono ⏳ acompañado del texto "esperando voto"

### Requirement: Reconexión automática
El sistema SHALL identificar a un participante que se reconecta mediante la combinación de nombre y sala, restaurando su estado (voto actual y posición en la sala) sin requerir que vuelva a unirse manualmente.

#### Scenario: Participante pierde y recupera conexión
- **WHEN** un participante con voto emitido pierde la conexión WebSocket y luego recarga la página uniéndose con el mismo nombre a la misma sala
- **THEN** el sistema lo reconoce como el mismo participante y restaura su voto y estado previos

### Requirement: Estado "desconectado" visible
El sistema SHALL marcar visualmente a un participante como "desconectado" ante la pérdida de su conexión WebSocket, manteniéndolo en la lista de participantes en lugar de eliminarlo.

#### Scenario: Participante pierde conexión durante la sesión
- **WHEN** la conexión WebSocket de un participante se cierra inesperadamente
- **THEN** el sistema actualiza su estado a "desconectado" para el resto de los participantes, sin quitarlo de la lista

### Requirement: Sala efímera con expiración automática
El sistema SHALL tratar cada sala como efímera, sin persistencia más allá de su ciclo de vida activo, expirando automáticamente su estado tras un período de inactividad.

#### Scenario: Sala inactiva expira
- **WHEN** una sala permanece sin actividad durante el período de expiración configurado
- **THEN** el sistema elimina automáticamente su estado persistido
