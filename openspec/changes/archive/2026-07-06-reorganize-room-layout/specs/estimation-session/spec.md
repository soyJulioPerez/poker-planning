## ADDED Requirements

### Requirement: Historia con título como precondición para votar
El sistema SHALL exigir que la sala tenga una historia actual con título asignado antes de permitir que un participante emita un voto. Si no hay historia asignada, el sistema SHALL rechazar el intento de voto, tanto en la interfaz (ocultando o deshabilitando el mazo de votación) como en el servidor.

#### Scenario: Participante intenta votar sin historia asignada
- **WHEN** un participante intenta emitir un voto mientras `currentStoryTitle` de la sala es nulo
- **THEN** el sistema rechaza el voto y no lo registra

#### Scenario: Interfaz no ofrece votar sin historia asignada
- **WHEN** un participante visualiza la sala mientras no hay una historia actual con título asignado
- **THEN** el mazo de votación no está disponible para seleccionar una carta

#### Scenario: Participante vota una vez asignada la historia
- **WHEN** el moderador asigna un título a la historia actual y un participante habilitado como votante selecciona una carta
- **THEN** el sistema registra su voto normalmente
