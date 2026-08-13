## ADDED Requirements

### Requirement: Las ramas largas solo avanzan por pull request

El sistema SHALL rechazar todo push directo a `develop` y a `master`. Cualquier cambio en esas ramas SHALL entrar por un pull request.

La verificación automática existe desde la Fase 1.1, pero hasta ahora era posible esquivarla por completo: un push directo a `master` desplegaba a producción sin que ninguna tarea se hubiera ejecutado. Un portón que se puede rodear no es un portón.

Esto SHALL aplicar también a quien administra el repositorio. Una regla con excepción por rol no cambia nada cuando el repositorio lo mantiene una sola persona, que es justamente quien tendría la excepción.

#### Scenario: Un push directo a una rama larga es rechazado

- **WHEN** alguien intenta pushear un commit directamente a `develop` o a `master`
- **THEN** GitHub rechaza el push

#### Scenario: La regla no tiene excepción para administradores

- **WHEN** quien administra el repositorio intenta pushear directamente a una rama protegida
- **THEN** el push es rechazado igual que para cualquier otra persona

#### Scenario: La promoción de un release entra por pull request

- **WHEN** una rama `release/*` está lista para producción
- **THEN** se promueve abriendo un pull request contra `master`, no con un push directo
- **AND** el merge conserva los commits del release y agrega un commit de merge que identifica la versión

### Requirement: Un pull request no se puede mergear sin la verificación en verde

El sistema SHALL impedir el merge de un pull request cuyas tareas de verificación no hayan terminado exitosamente, y SHALL exigir que la rama esté al día con su base antes de permitirlo.

Los checks obligatorios SHALL ser únicamente los de verificación. Los jobs de despliegue SHALL NOT ser obligatorios: están acotados por `if:` a `master` y `release/**`, así que en un pull request quedan salteados por diseño, y un check requerido que nunca reporta deja el pull request bloqueado de forma permanente.

La exigencia de estar al día reemplaza a la garantía que daba `git merge --ff-only` en la promoción a `master`: fallar cuando la rama de destino avanzó por otro lado.

#### Scenario: Un pull request con la verificación en rojo no se puede mergear

- **WHEN** un pull request tiene la tarea de verificación o la suite end-to-end en rojo
- **THEN** GitHub bloquea el merge hasta que ambas pasen

#### Scenario: Un pull request desactualizado no se puede mergear

- **WHEN** la rama base avanzó después de la última verificación del pull request
- **THEN** GitHub exige actualizar la rama y volver a verificar antes de permitir el merge

#### Scenario: Un job de despliegue salteado no bloquea el merge

- **WHEN** un pull request termina con las verificaciones en verde y los jobs de despliegue salteados
- **THEN** el pull request se puede mergear
