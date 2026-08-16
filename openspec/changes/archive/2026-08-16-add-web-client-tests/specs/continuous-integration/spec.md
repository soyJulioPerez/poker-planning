## ADDED Requirements

### Requirement: La cobertura de tests de `apps/web` no baja del umbral ya alcanzado

`apps/web` SHALL tener un umbral de cobertura de tests configurado en su target `test` (`@angular/build:unit-test`, runner Vitest), fijado en el valor ya alcanzado por la suite en el momento de establecerlo. La verificación SHALL fallar si la cobertura baja de ese umbral.

Este umbral es independiente del que ya existe para `apps/realtime-api`: son runners distintos (Vitest vs Jest) con targets y configuración separados, y no SHALL mezclarse en una sola medición.

#### Scenario: Una baja de cobertura deja la verificación de `web` en rojo

- **WHEN** un cambio reduce la cobertura de tests de `apps/web` por debajo del umbral configurado
- **THEN** la tarea `test` de `web` falla

#### Scenario: El umbral de `web` no se mezcla con el de `realtime-api`

- **WHEN** se ejecuta la tarea de test de cualquiera de los dos proyectos
- **THEN** su resultado de cobertura se mide y evalúa contra su propio umbral, sin combinarse con el del otro proyecto
