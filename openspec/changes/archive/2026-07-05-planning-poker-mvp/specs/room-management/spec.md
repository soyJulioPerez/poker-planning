## ADDED Requirements

### Requirement: Creación de sala
El sistema SHALL permitir a cualquier usuario crear una sala de Planning Poker sin necesidad de autenticarse, generando un identificador de sala único y un link/código para compartir.

#### Scenario: Usuario crea una sala nueva
- **WHEN** un usuario abre la aplicación y elige "Crear sala"
- **THEN** el sistema genera un `roomId` único, asigna a ese usuario como moderador, y muestra un link/código compartible

### Requirement: Unión a sala vía link o código
El sistema SHALL permitir que cualquier persona con el link o código de una sala existente se una indicando únicamente su nombre, sin autenticación.

#### Scenario: Participante se une con nombre disponible
- **WHEN** un usuario abre el link/código de una sala activa e ingresa un nombre no utilizado por otro participante conectado en esa sala
- **THEN** el sistema lo agrega a la sala como participante y notifica en vivo a los demás participantes

#### Scenario: Nombre ya en uso por un participante conectado
- **WHEN** un usuario intenta unirse a una sala con un nombre que ya pertenece a otro participante actualmente conectado en esa sala
- **THEN** el sistema rechaza la unión e indica que el nombre ya está en uso en esa sala

### Requirement: Rol de moderador único
El sistema SHALL asignar el rol de moderador exclusivamente a quien creó la sala, sin permitir transferencia ni co-moderación, y SHALL mostrar una indicación visual (badge) de dicho rol a todos los participantes.

#### Scenario: Badge de moderador visible
- **WHEN** un participante visualiza la lista de personas en la sala
- **THEN** el sistema muestra un badge distintivo junto al nombre del moderador

#### Scenario: Un participante no moderador intenta ejecutar una acción de moderación
- **WHEN** un participante que no es el moderador intenta revelar votos, resolver la historia o iniciar una nueva ronda
- **THEN** el sistema rechaza la acción

### Requirement: Moderador como votante opcional
El sistema SHALL permitir que el moderador decida si participa como votante o no, y SHALL permitir cambiar esa decisión únicamente cuando no haya una ronda de votación activa.

#### Scenario: Moderador activa su participación como votante entre rondas
- **WHEN** el moderador cambia la opción de "votar" estando la ronda en estado inactivo (sin votación en curso)
- **THEN** el sistema aplica el cambio y el moderador podrá votar en la siguiente ronda

#### Scenario: Intento de cambio durante ronda activa
- **WHEN** el moderador intenta cambiar su condición de votante mientras hay una votación en curso
- **THEN** el sistema rechaza el cambio y mantiene la condición vigente para la ronda actual

### Requirement: Lista de participantes en vivo
El sistema SHALL mantener y actualizar en tiempo real, para todos los miembros de la sala, la lista de participantes conectados.

#### Scenario: Nuevo participante se une
- **WHEN** un participante se une exitosamente a la sala
- **THEN** todos los demás participantes ven su nombre agregado a la lista sin necesidad de recargar la página

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
