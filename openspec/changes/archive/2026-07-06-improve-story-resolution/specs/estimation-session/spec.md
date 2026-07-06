## MODIFIED Requirements

### Requirement: Resolución manual de la historia
El sistema SHALL permitir únicamente al moderador definir el valor final de estimación de la historia actual tras el revelado, ya sea aceptando el promedio, aceptando la moda (solo cuando existe un único valor de moda), o seleccionando el voto numérico de un participante puntual como puntuación definitiva. Cuando la moda tiene más de un valor empatado, el sistema SHALL mostrar dichos valores como texto informativo, sin ofrecer un botón para aceptarlos directamente.

#### Scenario: Moderador acepta la moda como valor final
- **WHEN** el moderador, tras el revelado, la moda tiene un único valor y el moderador elige aceptarlo
- **THEN** el sistema asigna ese valor como la puntuación definitiva de la historia actual

#### Scenario: Moda empatada se muestra solo como texto informativo
- **WHEN** el moderador visualiza el revelado y la moda tiene más de un valor empatado
- **THEN** el sistema muestra los valores empatados como texto, sin un botón para aceptar la moda directamente

#### Scenario: Moderador selecciona el voto de un participante como valor final
- **WHEN** el moderador, tras el revelado, selecciona el voto numérico de un participante puntual
- **THEN** el sistema asigna ese valor como la puntuación definitiva de la historia actual
