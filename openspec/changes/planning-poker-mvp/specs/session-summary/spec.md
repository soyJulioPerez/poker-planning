## ADDED Requirements

### Requirement: Contador de historias estimadas en vivo
El sistema SHALL mostrar, durante toda la sesión, la cantidad de historias que ya fueron resueltas (con puntuación definitiva asignada).

#### Scenario: Se resuelve una historia
- **WHEN** el moderador confirma la puntuación final de una historia
- **THEN** el sistema incrementa y muestra a todos los participantes el contador de historias estimadas

### Requirement: Puntuación acumulada en vivo
El sistema SHALL mostrar, durante toda la sesión, la suma de las puntuaciones definitivas de todas las historias resueltas hasta el momento.

#### Scenario: Se resuelve una historia con puntuación numérica
- **WHEN** el moderador confirma la puntuación final de una historia con un valor numérico
- **THEN** el sistema suma ese valor al total acumulado y lo muestra actualizado a todos los participantes

### Requirement: Resumen final de la sesión
El sistema SHALL generar, al cerrar la sala, un resumen que incluya la lista de historias estimadas con su puntuación definitiva y la suma total de puntos.

#### Scenario: Moderador cierra la sala
- **WHEN** el moderador finaliza la sesión de la sala
- **THEN** el sistema muestra a todos los participantes un resumen con cada historia resuelta, su puntuación definitiva, y el total acumulado de la sesión
