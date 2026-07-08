## MODIFIED Requirements

### Requirement: Avance a la siguiente historia
El sistema SHALL permitir al moderador, una vez resuelta la historia actual, avanzar a una nueva historia reiniciando el estado de votación. Mientras no haya una nueva historia con título asignado, el sistema SHALL mostrar a todos los participantes el resultado de la última historia resuelta (título y puntaje final), si existe.

#### Scenario: Moderador avanza tras resolver la historia
- **WHEN** el moderador confirma la puntuación final de la historia actual y avanza a la siguiente
- **THEN** el sistema registra la historia resuelta y habilita una nueva ronda de votación en estado limpio

#### Scenario: Resultado de la última historia visible mientras se espera la siguiente
- **WHEN** una historia fue resuelta y todavía no se asignó título a la siguiente historia
- **THEN** el sistema muestra el título y puntaje final de la última historia resuelta junto con la indicación de que se espera al moderador

#### Scenario: Sin historial previo, no se muestra resultado
- **WHEN** ninguna historia fue resuelta todavía en la sesión y no hay una historia con título asignado
- **THEN** el sistema no muestra ningún resultado previo, solo la indicación de que se espera al moderador
