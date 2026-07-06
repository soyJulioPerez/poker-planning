## MODIFIED Requirements

### Requirement: Unión a sala vía link o código
El sistema SHALL permitir que cualquier persona con el link o código de una sala existente se una indicando únicamente su nombre, sin autenticación. La pantalla inicial SHALL mostrar la opción "Unirse a sala" seleccionada por defecto y posicionada primero (a la izquierda) entre las tabs, y el texto de la tab seleccionada (ya sea "Crear sala" o "Unirse a sala") SHALL mantener contraste suficiente para ser legible.

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
