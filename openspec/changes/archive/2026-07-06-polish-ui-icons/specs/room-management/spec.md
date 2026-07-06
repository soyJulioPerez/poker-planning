## MODIFIED Requirements

### Requirement: Lista de participantes en vivo
El sistema SHALL mantener y actualizar en tiempo real, para todos los miembros de la sala, la lista de participantes conectados. Para cada participante habilitado como votante, la lista SHALL indicar visualmente si ya emitió su voto (ícono ✓ junto al texto) o si está pendiente de votar (ícono ⏳ junto al texto).

#### Scenario: Nuevo participante se une
- **WHEN** un participante se une exitosamente a la sala
- **THEN** todos los demás participantes ven su nombre agregado a la lista sin necesidad de recargar la página

#### Scenario: Participante aún no ha votado
- **WHEN** un participante habilitado como votante todavía no emitió su voto en la ronda actual
- **THEN** el sistema muestra junto a su nombre el ícono ⏳ acompañado del texto "esperando voto"
