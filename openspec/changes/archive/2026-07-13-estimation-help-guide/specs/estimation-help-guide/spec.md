## ADDED Requirements

### Requirement: Botón de ayuda siempre accesible
El sistema SHALL mostrar un botón de ayuda fijo y visible en todo momento, tanto en la pantalla inicial (Home) como dentro de una sala (Room), independientemente del estado de la sesión.

#### Scenario: Botón visible en Home
- **WHEN** un usuario carga la pantalla inicial
- **THEN** el botón de ayuda es visible en una posición fija de la pantalla

#### Scenario: Botón visible dentro de una sala
- **WHEN** un usuario está en cualquier fase de una sala (esperando historia, votando, votos revelados, resumen final)
- **THEN** el botón de ayuda sigue siendo visible en la misma posición fija

### Requirement: Panel de guía de estimación
El sistema SHALL abrir un panel modal con contenido de buenas prácticas de estimación al hacer click en el botón de ayuda.

#### Scenario: Abrir el panel
- **WHEN** el usuario hace click en el botón de ayuda
- **THEN** se muestra un panel modal con el título "Guía de estimación" sobre un overlay que oscurece el resto de la pantalla

#### Scenario: Contenido organizado por audiencia
- **WHEN** el panel está abierto
- **THEN** muestra tres pestañas: contenido para quien es nuevo en Planning Poker, contenido para quien modera la sesión, y un recordatorio sobre el propósito de la técnica (el entendimiento compartido de la historia, no solo el número) dirigido a equipos con experiencia

#### Scenario: Cambiar de pestaña
- **WHEN** el panel está abierto y el usuario hace click en una pestaña distinta a la activa
- **THEN** el contenido mostrado cambia a la sección correspondiente, sin cerrar el panel

### Requirement: Cierre del panel de ayuda
El sistema SHALL permitir cerrar el panel de ayuda de múltiples formas equivalentes, sin alterar el estado de la sesión de estimación en curso.

#### Scenario: Cerrar con el botón "✕"
- **WHEN** el panel está abierto y el usuario hace click en el botón "✕"
- **THEN** el panel se cierra y la pantalla vuelve a su estado previo

#### Scenario: Cerrar haciendo click fuera del panel
- **WHEN** el panel está abierto y el usuario hace click en el overlay fuera del contenido del panel
- **THEN** el panel se cierra

#### Scenario: Cerrar con la tecla Esc
- **WHEN** el panel está abierto y el usuario presiona la tecla Esc
- **THEN** el panel se cierra

#### Scenario: El cierre no afecta la sesión
- **WHEN** el panel de ayuda se abre y se cierra en cualquier momento durante una ronda de votación activa
- **THEN** el voto propio, la fase de la ronda y el resto del estado de la sala permanecen sin cambios
