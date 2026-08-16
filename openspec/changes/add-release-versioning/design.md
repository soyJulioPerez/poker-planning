## Context

Estado real de partida, verificado (no el que describía el roadmap antes de este change):

- `package.json` raíz tiene `"version": "0.0.0"` — nunca se usó, no significa nada.
- 9 tags ya existen (`v1.0.0`...`v1.4.1`), todos puestos a mano en el paso 4 de `git-branching-strategy.md` (`git tag vX.Y.Z` después de mergear `release/*` a `master`).
- No hay `CHANGELOG.md`.
- `nx.json` no tiene bloque `release` — la Fase 3.2 lo **eliminó entero** (no lo dejó a medias), justamente para no versionar mal mientras no existiera este diseño.
- Solo dos proyectos del workspace tienen `package.json` propio: `packages/room-client-runtime` y `packages/shared-contracts`. Ninguna app (`apps/realtime-api`, `apps/web`, `apps/mobile`) lo tiene.
- `master` y `develop` tienen branch protection (PR obligatorio, checks obligatorios, sin push directo). `release/*` no está protegida — es efímera, ahí caen los commits directos de estabilización de QA.
- La promoción `release/* → master` es con **merge commit** (no squash, no rebase) — decisión ya tomada y documentada, conserva tal cual los commits que pasaron por QA.

## Goals / Non-Goals

**Goals:**
- Un comando computa el próximo número de versión desde Conventional Commits, genera el changelog y crea el tag — reemplaza el `git tag vX.Y.Z` manual del paso 4.
- El changelog queda commiteado en el repo, legible, sin ruido de commits de estabilización sin formato.
- El deploy a `prod` muestra qué versión se desplegó, no solo el SHA.

**Non-Goals:**
- La **lectura** de la versión actual sigue siendo solo por tag de git (`currentVersionResolver: git-tag`), no por `package.json` — pero ver Decisión 4b: los dos únicos `package.json` que existen en el workspace (`room-client-runtime`, `shared-contracts`) sí reciben la versión nueva **escrita** como efecto del versionado, aceptado a propósito, no evitado.
- No se agregan `package.json` a las apps solo para satisfacer la maquinaria de `nx release` — se rodea el problema (ver Decisión 4).
- No se automatiza la publicación a ningún registry — no aplica, este repo no publica paquetes.
- No se toca el flujo de `release/* → master` en sí (merge commit, no squash) — eso ya está resuelto y no es parte de este change.

## Decisions

### Decisión 1: los tags no necesitan ningún tratamiento especial por branch protection

Verificado explícitamente: branch protection en GitHub bloquea pushes que mueven el puntero de una **rama**, no la creación de un **tag**. `git push origin vX.Y.Z` nunca estuvo bloqueado y no lo estaría si lo hace `nx release version --git-tag` en vez de una persona a mano. El único caso que sí chocaría con la protección es si `nx release` quisiera además comitear un bump de `package.json` a `master` directamente — evitado por completo al no tocar `package.json` (ver Non-Goals).

### Decisión 2: `commitlint` verifica el título del PR, no los commits de la rama

El repo usa squash merge como regla (`docs/conventions.md`): el commit que aterriza en `develop` es uno nuevo, sintetizado por GitHub, cuyo mensaje por default es el **título del PR** — los commits individuales de la rama (wip, arreglos de typo, iteraciones) se descartan enteros, nunca llegan a `develop`.

Lintear los commits de la rama (la forma "de manual" de configurar commitlint) verificaría algo que se descarta, y dejaría pasar sin control lo único que sí queda en la historia: si el título del PR no sigue Conventional Commits, ese es el mensaje que `nx release changelog` va a intentar parsear, y ahí es donde realmente se rompe el changelog — no en los commits intermedios.

**Implementación**: un job en `ci.yml` (o una action tipo `amannn/action-semantic-pull-request`) que valida `github.event.pull_request.title` contra el formato Conventional Commits, bloqueante para el merge. No lintea nada dentro de la rama.

### Decisión 3: el changelog se genera con `--from`/`--to` explícitos, acotado a `develop`

`nx release changelog` soporta `--from <ref>` y `--to <ref>` (confirmado con `--help`, no es una suposición). En vez de dejarlo caminar desde `HEAD` — que en `master`, después del merge commit de la promoción, ya incluye los commits directos y sin formato de estabilización de QA — se lo acota a un rango que no los toca.

**Momento exacto — esto importa, y se corrigió durante la implementación**: el comando SHALL correr **inmediatamente al cortar `release/x.y.z`** (paso 2 del flujo, `git checkout -b release/x.y.z develop`), **antes de que exista ningún commit de estabilización** — no "antes de abrir el PR" como decía una versión anterior de este documento. En ese momento exacto, `release/x.y.z` y `develop` apuntan al mismo commit, así que `--to <rama-actual>` y `--to develop` son idénticos. Si en cambio se corriera más tarde, ya con commits de estabilización encima de la rama, `--to <rama-actual>` los incluiría igual — exactamente el problema que esta decisión busca evitar. La primera versión de `tasks.md` tenía este error (decía "antes de abrir el PR", que es *después* de la estabilización); se corrigió al notarlo durante la implementación.

```bash
# Inmediatamente después de cortar la rama, en el mismo momento, antes de cualquier fix de QA:
git checkout -b release/1.5.0 develop
npx nx release --skip-publish --git-tag=false   # versión + CHANGELOG.md + commit, ver Decisión 4
git push origin release/1.5.0
```

**Probado en vivo** (dry-run real contra el historial del repo, no hipotético): generó correctamente un changelog agrupado en `🚀 Features`/`🩹 Fixes`, incluyendo solo commits `feat:`/`fix:` desde el último tag — los de tipo `docs:`/`ci:`/`chore:` (como "Fase 5.2 — auditoría de dependencias", que es `ci:`) quedaron afuera del changelog visible sin intervención manual, que es el comportamiento correcto: un cambio de CI no es una feature para quien usa la app.

**Por qué acotar al punto de corte no es una pérdida real**: un commit de estabilización casi siempre arregla un bug de una funcionalidad que todavía no se lanzó — esa historia ya tiene su línea en el changelog por el commit original de `develop` que la introdujo. El fix de QA no es un cambio nuevo para el usuario, es terminar de pulir uno que ya está representado.

**Escape hatch, no mecanismo default**: si aparece un fix de QA genuinamente notable que amerita su propia línea, se agrega a mano a la entrada del changelog en el mismo PR de promoción — no se automatiza este caso raro, automatizarlo mal sería peor que no automatizarlo.

**Dónde vive el commit del changelog**: en la rama `release/x.y.z`, como su primer commit — así entra por el mismo gate de verificación (`verify`, `e2e`) que cualquier otro cambio a `master` cuando esa rama se promueva, sin necesitar una excepción a la protección de rama ni un paso separado fuera del flujo de PR ya establecido.

### Decisión 4: el bloque `release` de `nx.json` usa resolución de versión por `git-tag`, no por `package.json`

```json
{
  "release": {
    "projectsRelationship": "fixed",
    "projects": ["room-client-runtime", "shared-contracts"],
    "version": {
      "manifestRootsToUpdate": [],
      "conventionalCommits": true
    }
  }
}
```

`conventionalCommits: true` es lo que hace que la versión se infiera sola (`feat` → minor, `fix` → patch, `BREAKING CHANGE`/`!` → major) — sin esto, `nx release version` pregunta interactivamente qué tipo de bump aplicar, cosa que no sirve para un flujo automatizable. **Probado en vivo**: combinarlo con un `currentVersionResolver` explícito (`"git-tag"`) da un error de configuración conflictiva — `conventionalCommits` ya trae implícita la resolución por tag, no hace falta (ni se puede) declararla aparte.

**Por qué `projects` queda acotado a esos dos**, y no a todo el workspace (`["*"]`, que sería lo natural dado que `projectsRelationship: "fixed"` versiona todo el repo junto): **probado en vivo**, intentar correr `nx release changelog` con las apps incluidas falla — `apps/realtime-api`, `apps/web` y `apps/mobile` no tienen `package.json` propio, y la maquinaria de resolución de versión de `nx release` lo necesita como ancla incluso con `currentVersionResolver: "git-tag"` y `manifestRootsToUpdate: []`. Agregarles un `package.json` solo para satisfacer esto sería una ficción — no publican nada, no tienen versión propia.

**Por qué esto no limita el contenido del changelog**: también probado en vivo — el changelog generado con esos dos proyectos como `release.projects` igual incluyó commits sobre `realtime-api` (logging, tracing, alarmas). El changelog workspace-level (sin `changelog.projectChangelogs` habilitado) camina el rango de commits completo del `--from`/`--to`, no filtra por qué proyecto tocó cada commit. El `projects` acotado solo sirve de ancla para la resolución de versión, no restringe qué aparece en `CHANGELOG.md`.

### Decisión 4b: `room-client-runtime` y `shared-contracts` sí reciben el número de versión en su `package.json`, a propósito

**Probado en vivo** (dry-run real): incluso con `manifestRootsToUpdate: []`, `nx release version` escribe igual la versión nueva en el `package.json` de cada proyecto del release group que ya tiene uno — `manifestRootsToUpdate` controla manifiestos *adicionales*, no si actualizar el manifiesto propio del proyecto. No se encontró una opción de configuración que evite esto sin trabajo adicional (por ejemplo, una implementación custom de `versionActions`), y no se lo persiguió más allá de confirmarlo.

**Decisión**: aceptar que esos dos `package.json` —los únicos dos que existen en todo el workspace— reciban la versión nueva como efecto del versionado, en vez de seguir buscando cómo evitarlo. Revisa el Non-Goal original ("no se bumpea ningún `package.json`"), pero no reintroduce el problema que ese Non-Goal buscaba evitar:

- La **lectura** de la versión actual sigue siendo por tag de git, no por `package.json` (`currentVersionResolver` sigue siendo tag-based vía `conventionalCommits`) — el `package.json` es un efecto secundario, no la fuente de verdad.
- El commit que escribe estos dos archivos vive en la rama `release/*`, junto con `CHANGELOG.md`, como primer commit al cortar la rama (Decisión 3) — no reabre ninguna excepción a branch protection.
- Ningún archivo de app (`realtime-api`, `web`, `mobile`) se ve afectado — no tienen `package.json`.
- Efecto colateral positivo: esos dos `package.json` dejan de decir `0.0.1` sin sentido — quedan sincronizados con el tag real.

### Decisión 5: versión de la app visible en el deploy, vía `$GITHUB_STEP_SUMMARY`

Hoy ningún workflow de deploy escribe nada al resumen del run (verificado: `grep GITHUB_STEP_SUMMARY` en ambos workflows no da resultados). Se agrega un paso que escribe el tag desplegado (`git describe --tags` sobre el commit desplegado, o el input `ref` cuando el deploy es manual) al resumen — visible en la pestaña Actions sin tener que buscar el SHA.

## Risks / Trade-offs

- **[Riesgo]** `nx release version` podría, con configuración por defecto, intentar escribir algo en `package.json` a pesar de `manifestRootsToUpdate: []`. **Mitigación**: se prueba explícitamente con `--dry-run` antes de usarlo en el flujo real (tarea de verificación en `tasks.md`), no se asume que la config alcanza sin comprobarlo.
- **[Riesgo]** Si algún día una app necesita publicarse como paquete (por ejemplo, si `room-client-runtime` se separa a un registry propio), la relación `fixed` con un único tag para todo el repo dejaría de tener sentido para esa app puntual. **Mitigación**: no aplica hoy — la Fase 3.2 ya fijó esta dirección explícitamente, y moverse a `independent` es un cambio de diseño futuro, no algo a resolver acá.
- **[Riesgo]** El job de lint del título del PR es nuevo — si el título de un PR viejo (abierto antes de este change) no sigue el formato, quedaría bloqueado al reabrir/actualizar. **Mitigación**: no hay PRs abiertos de larga duración en este repo hoy (verificado); el costo de migración es despreciable.

## Migration Plan

1. Agregar el bloque `release` a `nx.json`, verificado con `--dry-run` antes de tocar nada real.
2. Agregar el job de lint del título del PR a `ci.yml`.
3. Agregar el paso de versión en el resumen a `deploy-backend.yml`/`deploy-web.yml`.
4. Corregir el paso 4 de `docs/git-branching-strategy.md` para reflejar el nuevo mecanismo (changelog en la rama de release, tag después del merge).
5. No hay migración de datos ni rollback especial — es tooling de CI/release, no cambia comportamiento de la app. El primer uso real ocurre en el próximo release que se corte después de mergear este change.
