# release-versioning Specification

## Purpose
TBD - created by archiving change add-release-versioning. Update Purpose after archive.
## Requirements

### Requirement: El repo tiene un único número de versión, derivado de tags de git

El sistema SHALL versionar el repositorio completo como una unidad (`projectsRelationship: fixed`), no por proyecto individual. El tag de git más reciente SHALL ser la única fuente de verdad para **determinar** el número de versión actual — ningún archivo de manifiesto (`package.json` u otro) SHALL usarse para leer la versión vigente.

Los `package.json` de los proyectos del workspace que ya tengan uno PUEDEN recibir la versión nueva escrita como efecto del versionado (no se evita a propósito, ver `design.md` Decisión 4b) — esto no cambia cuál es la fuente de verdad, solo registra el número también ahí.

#### Scenario: La versión actual se lee del último tag

- **WHEN** se computa la versión actual del repositorio
- **THEN** se resuelve leyendo el tag de git más reciente con formato `vX.Y.Z`, no un campo de `package.json`

#### Scenario: Los proyectos sin `package.json` no se ven afectados

- **WHEN** se genera una nueva versión
- **THEN** ningún archivo se crea ni se modifica en `apps/realtime-api`, `apps/web` o `apps/mobile` — ninguno tiene `package.json` propio

### Requirement: El próximo número de versión se computa desde Conventional Commits

El sistema SHALL determinar automáticamente el incremento de versión (patch/minor/major) a partir de los tipos de commit (`fix`, `feat`, `BREAKING CHANGE`) presentes desde el último tag hasta el punto de corte, sin requerir que una persona decida el número a mano.

#### Scenario: Un commit `feat` incrementa la versión menor

- **WHEN** desde el último tag hay al menos un commit `feat` y ningún `BREAKING CHANGE`
- **THEN** el próximo número de versión incrementa la posición `minor`

#### Scenario: Un commit `fix` sin `feat` incrementa la versión de parche

- **WHEN** desde el último tag solo hay commits `fix` (sin `feat` ni `BREAKING CHANGE`)
- **THEN** el próximo número de versión incrementa la posición `patch`

### Requirement: El changelog se genera desde `develop`, no desde `master`

El sistema SHALL generar `CHANGELOG.md` a partir del rango de commits entre el último tag y la punta de `develop`, y SHALL NOT incluir en ese rango los commits directos de estabilización que existan únicamente en una rama `release/*` sin haber pasado por `develop`.

El commit que agrega la entrada nueva al changelog SHALL crearse dentro de la rama `release/*` **inmediatamente al cortarla desde `develop`, antes de que exista cualquier commit de estabilización** — no en un momento posterior, porque en ese punto la rama y `develop` apuntan al mismo commit y el rango queda naturalmente libre de commits de estabilización. Ese commit, al promoverse a `master` más adelante, pasa por el mismo portón de verificación (`verify`, `e2e`) que cualquier otro cambio.

#### Scenario: El changelog agrupa por tipo de commit

- **WHEN** se genera el changelog para un rango que incluye commits `feat` y `fix`
- **THEN** la entrada nueva los agrupa en secciones separadas ("Features", "Fixes"), y excluye commits de tipos no orientados a usuario (`docs`, `ci`, `chore`, `test`)

#### Scenario: Un commit directo de estabilización no aparece en el changelog automático

- **WHEN** una rama `release/*` recibe un commit directo (sin pasar por `develop`) durante la estabilización en QA
- **THEN** ese commit SHALL NOT generar una entrada en `CHANGELOG.md`, salvo que se agregue manualmente a la entrada de esa versión

### Requirement: El tag se crea después de promover a `master`, no antes

El sistema SHALL crear y publicar el tag de la nueva versión únicamente después de que el pull request de `release/*` a `master` se mergeó exitosamente, apuntando al commit de merge resultante.

#### Scenario: El tag apunta al merge commit de la promoción

- **WHEN** se promueve una rama `release/*` a `master` mediante un pull request mergeado con "Create a merge commit"
- **THEN** el tag de la nueva versión se crea sobre ese merge commit específico, después de que el merge ya ocurrió

### Requirement: La versión desplegada es visible sin buscar el SHA

El sistema SHALL mostrar la versión (tag) que se desplegó a cada ambiente en el resumen del run del workflow de deploy correspondiente, no solo el SHA del commit.

#### Scenario: El resumen del deploy muestra el tag desplegado

- **WHEN** termina un run del workflow de deploy a cualquier ambiente
- **THEN** el resumen del run (`$GITHUB_STEP_SUMMARY`) incluye el tag o versión desplegada, visible sin abrir los logs del job
