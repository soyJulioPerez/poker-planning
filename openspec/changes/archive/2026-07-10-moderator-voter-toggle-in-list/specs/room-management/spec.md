## MODIFIED Requirements

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
