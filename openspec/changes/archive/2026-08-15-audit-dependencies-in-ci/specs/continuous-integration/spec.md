## ADDED Requirements

### Requirement: La cadena de dependencias se audita en cada verificación

El sistema SHALL ejecutar `npm audit` sobre el `package-lock.json` de la raíz del repositorio en cada pull request y en cada push a `develop`, `release/**` y `master`, en un job independiente que corre en paralelo al resto de la verificación.

El sistema SHALL definir explícitamente un umbral de severidad: una vulnerabilidad de severidad `critical` SHALL dejar el job en rojo. Vulnerabilidades de severidad `high`, `moderate` o `low` SHALL quedar visibles en el log del job, pero SHALL NOT hacerlo fallar.

Este job SHALL NOT usar el exit code silenciado (`|| true` o equivalente): un umbral que no rompe nunca el build no es una auditoría, es un log que nadie lee.

`apps/mobile` tiene su propio `package-lock.json`, separado del de la raíz, y queda fuera del alcance de este requirement.

#### Scenario: Una vulnerabilidad crítica deja el job en rojo

- **WHEN** el árbol de dependencias instalado tiene al menos una vulnerabilidad de severidad `critical`
- **THEN** el job de auditoría de dependencias falla

#### Scenario: Una vulnerabilidad de severidad menor no rompe el job

- **WHEN** el árbol de dependencias instalado tiene vulnerabilidades de severidad `high`, `moderate` o `low`, y ninguna `critical`
- **THEN** el job de auditoría de dependencias termina exitosamente
- **AND** el detalle de esas vulnerabilidades queda visible en el log del job

#### Scenario: El job corre en paralelo, no en serie

- **WHEN** se dispara la verificación de un pull request o de un push a una rama larga
- **THEN** el job de auditoría de dependencias arranca al mismo tiempo que `verify`, `test-integration` y `e2e`, sin esperar a que ninguno termine

### Requirement: Una vulnerabilidad crítica bloquea el despliegue automático

El sistema SHALL impedir que `deploy-backend` y `deploy-web` se ejecuten si el job de auditoría de dependencias falló.

#### Scenario: Un deploy no arranca con una vulnerabilidad crítica sin resolver

- **WHEN** el job de auditoría de dependencias falla en un push a `master` o a una rama `release/**`
- **THEN** `deploy-backend` y `deploy-web` no se ejecutan
