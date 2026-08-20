# Convención de ramas y ambientes

Guía de cómo se usan las ramas `develop`, `release/*` y `master` en este repo, y cómo se relacionan con los tres ambientes de backend (`dev`, `qa`, `prod`). Ver el diseño completo en `openspec/changes/add-multi-environment-deployment/design.md`.

## Estrategia actual (resumen)

Tres ramas de larga vida más una efímera:

| Rama | Rol | Protegida | Ambiente | Deploy |
|---|---|---|---|---|
| `develop` | Integración de features y fixes | Sí | `dev` | Manual |
| `release/X.Y.Z` | Estabilización de un release en curso | No | `qa` | Automático en cada push |
| `master` | Producción | Sí | `prod` | Automático al mergear el PR (no admite push directo) |

Flujo, de punta a punta:

1. Features y fixes se mergean a `develop` (squash merge; fast-forward como excepción puntual).
2. Se corta `release/X.Y.Z` desde `develop`. `nx release` resuelve versión y changelog en ese momento.
3. Los fixes de estabilización se commitean directo sobre `release/X.Y.Z`; cada push redespliega `qa`.
4. `release/X.Y.Z` se promueve a `master` por pull request (merge commit; `master` no admite push directo). Se taggea `vX.Y.Z` y se crea el Release de GitHub. El merge a `master` despliega `prod`.
5. `master` se sincroniza de vuelta a `develop` por pull request (merge commit).
6. `release/X.Y.Z` se borra cuando cada developer lo considere oportuno; el tag queda como referencia permanente.

Para rollback: `qa` se pisa libremente reapuntando `release/*` a un tag anterior; `prod` nunca reescribe `master`, se redespliega un tag anterior a mano.

El resto de este documento detalla cada paso, con los comandos exactos y las razones detrás de cada decisión.

Desde el 2026-08-13 (Fase 1.3 del [roadmap](hardening-roadmap.md)) esto **está forzado por GitHub**, no depende de que cada uno recuerde los pasos. `develop` y `master` están protegidas:

| Regla | Qué significa en la práctica |
|---|---|
| Pull request obligatorio | `git push origin develop` y `git push origin master` son rechazados |
| `verify` y `e2e` obligatorios | El botón de merge queda gris hasta que los dos estén en verde |
| Rama al día antes de mergear | Si la rama base avanzó, GitHub pide actualizar y volver a verificar |
| Sin excepción para administradores | Las reglas aplican también a quien mantiene el repositorio |
| 0 aprobaciones requeridas | Provisorio: GitHub no permite aprobar el propio pull request, y hoy hay una sola persona con acceso de escritura. **Sube a 1 en cuanto entre la segunda.** |

`release/*` **no** está protegida: es efímera y ahí caen los fixes de estabilización. El riesgo está acotado porque nada llega a producción sin pasar por el pull request a `master`.

Para leer la configuración vigente sin entrar a Settings:

```bash
gh api repos/:owner/:repo/branches/develop/protection --jq '{
  pr_obligatorio: (.required_pull_request_reviews != null),
  aprobaciones: .required_pull_request_reviews.required_approving_review_count,
  checks: .required_status_checks.contexts,
  rama_al_dia: .required_status_checks.strict,
  aplica_a_admins: .enforce_admins.enabled
}'
```

Vale la pena tenerlo a mano: la protección vive en GitHub, no en el repositorio, así que un cambio en Settings no deja rastro en la historia del proyecto.

## Mapeo rama → ambiente

| Rama | Ambiente | Trigger |
|---|---|---|
| `develop` | `dev` (stack `poker-planning-dev`, el que ya existía) | Manual (`workflow_dispatch`, elegir `environment: dev`) |
| `release/*` | `qa` (stack `poker-planning-qa`) | Automático en cada push |
| `master` | `prod` (stack `poker-planning-prod`) | Automático al mergear el PR (no admite push directo) |

`release/*` es un patrón (`release/**` en el trigger de CI) — cualquier rama que matchee despliega y **pisa** el mismo stack `qa` compartido. Esto es intencional: no hay stacks de QA por versión, y sirve como mecanismo de rollback (ver más abajo).

**Por qué `develop` es manual y no automático como los otros dos.** `develop` recibe commits frecuentes de trabajo en progreso (squash merges de features chicas); auto-desplegar cada uno sería ruido y podría dejar el stack `dev` en un estado intermedio roto mientras se itera. El disparo manual le da al desarrollador control sobre el momento. `release/*` y `master` sí son automáticos porque ahí ya hay una intención explícita de "esto va a QA" o "esto va a producción" — en `develop` esa intención todavía no existe.

## Flujo normal de trabajo

```
feature/x ──╮
feature/y ──┼─▶ (squash merge) ──▶ develop ──branch──▶ release/1.5.0 ──PR + merge──▶ master
feature/z ──╯                         ▲                      │                       │
                                       │                  (bugfixes commiteados      merge → deploy
                                       │                   directo, cada push          automático PROD
                                       │                   redeploya QA)               │
                                       ╰────────── merge (único), desde `master` ──────╯
                                        una vez taggeado el release (nunca desde `release/X.Y.Z`,
                                        ver la nota del paso 5)
```

1. **Features → `develop`**: cada feature/fix se mergea a `develop` por **squash merge** (un solo commit por feature, sin importar cuántos commits tuvo la rama). No dispara deploy automático — se prueba en el ambiente `dev` cuando el desarrollador lo dispare manualmente.

   **Excepción: fast-forward.** Cuando la rama trae commits limpios y separados a propósito que vale la pena conservar en la historia de `develop` —por ejemplo un `docs:` y un `chore:` que no tienen por qué mezclarse— se mergea así en vez de aplastarlos:
   ```bash
   git checkout develop
   git merge --ff-only <rama>
   ```
   Es la **excepción, no la vía habitual**. Solo aplica si la historia de la rama ya está exactamente como se la quiere ver en `develop`: sin commits de `WIP`, sin "arregla typo", sin idas y vueltas. Si hay ruido, se hace squash. `--ff-only` falla en vez de crear un merge commit si `develop` avanzó mientras tanto — misma protección que en la promoción a `master`.

2. **Cortar un release**: primero correr `nx release` **contra `develop`, antes de crear la rama** — así el nombre de la rama puede reflejar el número real que calculó la herramienta, no una etiqueta puesta a ojo:
   ```bash
   git checkout develop
   npx nx release --skip-publish --dry-run   # solo para ver qué versión va a calcular
   git checkout -b release/X.Y.Z develop     # X.Y.Z = la versión real de arriba
   npx nx release --skip-publish
   git push origin release/X.Y.Z
   ```
   Cortar una rama nunca genera un commit de merge. El push dispara el deploy automático a `qa`.

   **El paso de `nx release` va acá, no más adelante, y es a propósito**: en este momento exacto la rama y `develop` apuntan al mismo commit, así que el changelog que genera cubre justo lo nuevo desde el último release, sin nada más. Calcula la próxima versión desde Conventional Commits (`feat` → minor, `fix` → patch, `BREAKING CHANGE`/`!` → major), escribe una entrada nueva en `CHANGELOG.md`, y de paso actualiza el `package.json` de `room-client-runtime` y `shared-contracts` (los únicos dos del workspace que tienen uno) — todo en un solo commit. Si este paso se corriera más tarde, después de que aparezcan fixes de estabilización, el changelog los arrastraría con su mensaje de commit crudo, sin formato — exactamente lo que se busca evitar.

   **Sin `--git-tag=false`**: esa opción no existe en el comando orquestador (`nx release [specifier]`) — solo en sus subcomandos (`nx release version`/`nx release changelog`) por separado. Que este paso no taggee todavía se controla en `nx.json` (`release.version.git.tag: false` y `release.changelog.git.tag: false` — en dos bloques separados, uno por subcomando; un `release.git` compartido alcanza para el orquestador, pero `nx release changelog` corrido como subcomando aislado lo rechaza) — el tag sigue siendo el paso 4, manual, después del merge a `master`.

   **Si el changelog generado arrastra de más** (repite features/fixes de un release anterior en vez de solo lo nuevo): señal de que el tag más reciente no es ancestro de `develop` — confirmalo con `git merge-base --is-ancestor <tag> develop`. Si algún ciclo anterior sincronizó el paso 5 desde `release/X.Y.Z` en vez de desde `master` (ver más abajo), corré version y changelog por separado con rango explícito en vez de confiar en la detección automática:
   ```bash
   npx nx release version X.Y.Z --skip-publish --git-commit=false
   npx nx release changelog X.Y.Z --from=<tag-anterior> --skip-publish --git-commit=false
   git commit -am "chore(release): publish X.Y.Z"
   ```

3. **Estabilización en QA**: los bugs que aparecen se corrigen con commits directos sobre `release/1.5.0`, encima del commit de `nx release` del paso anterior. Cada push redeploya y pisa QA. Estos commits **no** entran al changelog automático — si alguno amerita su propia línea, se agrega a mano en la descripción del PR de promoción (paso 4).

4. **Promoción a `master`** — por pull request, con **merge commit**:

   ```bash
   gh pr create --base master --head release/1.5.0 --title "chore(release): publish 1.5.0"
   ```

   El título SHALL seguir Conventional Commits (`tipo: descripción`) — el check `pr-title` de la Fase 7.1 es obligatorio también en `master`, y bloquearía este mismo PR si el título no cumple. `chore(release): publish X.Y.Z` sigue la misma convención que ya usa el commit que generó `nx release` en el paso 2 (verificable con `git log -1 --format=%s` en la punta de la rama de release).

   En la interfaz: esperar a que `verify` y `e2e` estén en verde, y mergear con **Create a merge commit** (no *Squash*, no *Rebase*). Después:

   ```bash
   git checkout master && git pull
   git tag v1.5.0
   git push origin v1.5.0
   awk '/^## /{n++} n==1' CHANGELOG.md > /tmp/release-notes-1.5.0.md
   gh release create v1.5.0 --title v1.5.0 --notes-file /tmp/release-notes-1.5.0.md
   ```

   **En Git Bash (Windows), no uses `--notes-file <(awk ...)`.** La sustitución de procesos (`<(...)`) crea el archivo como una ruta virtual de MSYS (`/proc/<pid>/fd/<n>`), y `gh.exe` es un binario nativo de Windows que no sabe leerla — falla con `open /proc/.../fd/63: The system cannot find the path specified.`. Escribir a un archivo real primero (como arriba) evita el problema.

   El tag queda simple y manual a propósito: la versión y el changelog ya se resolvieron en el paso 2, y volver a correr `nx release` acá recomputaría desde cero (o fallaría, por no haber nada nuevo que versionar) — el único trabajo que queda es marcar con el tag el commit de merge resultante, algo que un comando de una línea ya resuelve sin necesitar más herramienta.

   El Release de GitHub se crea con `gh release create`, no con la opción nativa de `nx release` (`release.changelog.workspaceChangelog.createRelease: 'github'` en `nx.json`) — esa opción crea el tag **junto con** el Release, en el mismo momento en que corre `nx release`. Acá el tag se crea recién en este paso, después del merge; activarla haría que el Release (y su tag automático) se generen en el paso 2, contra el commit de corte de la rama, no contra el merge commit real — exactamente el problema que el paso 2 evita a propósito para el changelog. El `awk '/^## /{n++} n==1'` extrae solo la entrada más reciente de `CHANGELOG.md` (desde el primer `## ` hasta el siguiente), para no repetir todo el historial como descripción de cada Release.

   El merge dispara el deploy automático a `prod`.

   **Tres cosas que conviene entender de este paso:**

   - **Por qué merge commit y no las otras dos opciones.** De las tres que ofrece GitHub, solo *Create a merge commit* conserva tal cual los commits que pasaron por QA. *Squash* los colapsa en uno nuevo y *Rebase* los reescribe con otro identificador, así que el tag estaría marcando código que nunca existió en QA.
   - **El merge commit no es ruido, es el marcador del release.** `git log --first-parent master` da una línea por release, y el pull request queda como acta de qué entró.
   - **Qué reemplazó al `--ff-only`.** Antes este paso era `git merge --ff-only` + `git push`, y el valor de `--ff-only` era que **fallaba** si `master` había avanzado por otro lado. Esa alarma ahora la da GitHub: si la rama de release quedó desactualizada, el merge no se habilita hasta que la actualices.

5. **Sync de vuelta a `develop`** — **después** de promover a `master`, tag incluido, nunca antes (ver la nota de abajo). `develop` necesita este contenido igual que antes (si no, el próximo release cortado desde `develop` pierde los bugfixes de estabilización), pero se sincroniza **desde `master`, no desde `release/1.5.0`**. `git push origin develop` directo no funciona — `develop` exige pull request igual que `master` (Fase 1.3, aplica también a administradores):
   ```bash
   gh pr create --base develop --head master --title "chore(release): sync 1.5.0 a develop"
   ```
   Mergear desde la interfaz con **Create a merge commit** (mismo motivo que el paso 4: conservar los commits tal cual, no aplastarlos ni reescribirlos) — es el único merge commit aceptado contra `develop` en todo el flujo.

   **Por qué desde `master` y no desde `release/1.5.0`.** Sincronizar desde la rama de release, en vez de desde `master`, hace que `master` y `develop` reciban el mismo contenido por dos merge commits distintos — uno por cada PR — que son hermanos entre sí: ninguno es ancestro del otro. El tag del release, creado sobre el merge commit de `master`, queda entonces inalcanzable desde `develop`, y el próximo `nx release` corrido contra `develop` (paso 2 del ciclo siguiente) no lo encuentra: calcula mal la versión y arrastra el changelog completo del release anterior en vez de solo lo nuevo (ver la nota del paso 2 sobre qué hacer si esto ya pasó). Sincronizar desde `master` evita el problema de raíz — su merge commit (ya taggeado) pasa a ser ancestro de `develop`, así que el tag queda alcanzable para el próximo corte. Como bonus, el paso queda indiferente a si el paso 4 se mergeó con *merge commit* o, por error, con *squash*: lo único que importa acá es la punta de `master`.

   **El botón "Update branch" de este PR va a fallar — es esperable.** Con `head=master`, ese botón intenta mergear `develop` (la base) hacia `master` (el head) y pushear el resultado directo a `master`, que lo rechaza por estar protegida: `Couldn't update "master": Changes must be made through a pull request`. No afecta si el PR en sí se puede mergear — confirmá eso mirando que diga "No conflicts with base branch", no el resultado de ese botón.

6. **Limpieza de `release/1.5.0`**: a criterio de cada developer, sin política automática. El tag (`v1.5.0`) queda como referencia permanente aunque la rama se borre.

> ### El orden de los pasos 4 y 5 no es cosmético
>
> **Promover a `master` va primero. Sincronizar `develop` va después.** Al revés, el deploy a producción no ocurre y la corrida de CI queda en verde.
>
> El motivo está en cómo `nx affected` elige contra qué comparar. `nrwl/nx-set-shas` recibe `main-branch-name: develop`, y para cualquier rama que no sea esa usa el SHA de **la última corrida exitosa del workflow sobre `develop`**. Si `develop` ya absorbió el release y su CI pasó, ese SHA es el mismo commit que estás promoviendo:
>
> ```
> develop  32aee6c  ✅ corrida exitosa      ← nx-set-shas toma esta como base
> master   32aee6c  ← se promueve después
>                       NX_BASE == NX_HEAD, diff vacío
> ```
>
> Sin diff no hay proyectos afectados, los jobs de deploy no se ejecutan, y nada queda en rojo.
>
> **Pasó de verdad** promoviendo `v1.4.0` el 2026-08-11: producción se quedó en `v1.3.1` con el check verde.
>
> `ci.yml` ahora se defiende de esto —en `master` usa `github.event.before` como base, que no depende de dónde esté `develop`— así que el orden invertido ya no rompe el deploy. Pero el orden documentado sigue siendo el correcto: es el que mantiene `master` como la referencia de lo que está en producción.

## Runbook: promover de `develop` a `master`

Los mismos pasos de arriba, solo los comandos.

1. Cortar la rama de release:
   ```bash
   git checkout develop
   npx nx release --skip-publish --dry-run
   git checkout -b release/X.Y.Z develop
   npx nx release --skip-publish
   git push origin release/X.Y.Z
   ```

2. Estabilización: commits directos sobre `release/X.Y.Z`, cada uno pusheado.

3. Promoción a `master`:
   ```bash
   gh pr create --base master --head release/X.Y.Z --title "chore(release): publish X.Y.Z"
   ```
   Esperar `verify` y `e2e` en verde. Mergear en la interfaz con **Create a merge commit**.

4. Tag y Release de GitHub:
   ```bash
   git checkout master && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   awk '/^## /{n++} n==1' CHANGELOG.md > /tmp/release-notes-X.Y.Z.md
   gh release create vX.Y.Z --title vX.Y.Z --notes-file /tmp/release-notes-X.Y.Z.md
   ```

5. Sync de `master` a `develop`:
   ```bash
   gh pr create --base develop --head master --title "chore(release): sync X.Y.Z a develop"
   ```
   Mergear en la interfaz con **Create a merge commit**.

6. Limpieza (opcional):
   ```bash
   git push origin --delete release/X.Y.Z
   ```

## Rollback

**QA**: pisar libremente. Para volver a una versión anterior, pushear ese código a una rama `release/*`:
```bash
git checkout v1.4.0
git push origin v1.4.0:release/1.5.0 --force
```

**PROD**: nunca se reescribe `master`. En vez de eso, disparar manualmente el workflow de deploy backend con `environment: prod` y el input `ref` apuntando al tag a restaurar:
```bash
gh workflow run deploy-backend.yml -f environment=prod -f ref=v1.4.0
```
Esto despliega ese commit al stack `prod` sin mover el puntero de la rama `master`.
