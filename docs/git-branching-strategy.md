# Convención de ramas y ambientes

Guía de cómo se usan las ramas `develop`, `release/*` y `master` en este repo, y cómo se relacionan con los tres ambientes de backend (`dev`, `qa`, `prod`). Ver el diseño completo en `openspec/changes/add-multi-environment-deployment/design.md`.

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
| `master` | `prod` (stack `poker-planning-prod`) | Automático en cada push |

`release/*` es un patrón (`release/**` en el trigger de CI) — cualquier rama que matchee despliega y **pisa** el mismo stack `qa` compartido. Esto es intencional: no hay stacks de QA por versión, y sirve como mecanismo de rollback (ver más abajo).

## Flujo normal de trabajo

```
feature/x ──╮
feature/y ──┼─▶ (squash merge) ──▶ develop ──branch──▶ release/1.5.0 ──ff + tag──▶ master
feature/z ──╯                         ▲                      │                       │
                                       │                  (bugfixes commiteados      push → deploy
                                       ╰── merge (único) ──╯   directo, cada push      automático PROD
                                        de vuelta tras cerrar   redeploya QA)
                                        el release
```

1. **Features → `develop`**: cada feature/fix se mergea a `develop` por **squash merge** (un solo commit por feature, sin importar cuántos commits tuvo la rama). No dispara deploy automático — se prueba en el ambiente `dev` cuando el desarrollador lo dispare manualmente.

   **Excepción: fast-forward.** Cuando la rama trae commits limpios y separados a propósito que vale la pena conservar en la historia de `develop` —por ejemplo un `docs:` y un `chore:` que no tienen por qué mezclarse— se mergea así en vez de aplastarlos:
   ```bash
   git checkout develop
   git merge --ff-only <rama>
   ```
   Es la **excepción, no la vía habitual**. Solo aplica si la historia de la rama ya está exactamente como se la quiere ver en `develop`: sin commits de `WIP`, sin "arregla typo", sin idas y vueltas. Si hay ruido, se hace squash. `--ff-only` falla en vez de crear un merge commit si `develop` avanzó mientras tanto — misma protección que en la promoción a `master`.

2. **Cortar un release**: cuando `develop` tiene algo listo para pasar a QA:
   ```bash
   git checkout -b release/1.5.0 develop
   git push origin release/1.5.0
   ```
   Cortar una rama nunca genera un commit de merge. El push dispara el deploy automático a `qa`.

3. **Estabilización en QA**: los bugs que aparecen se corrigen con commits directos sobre `release/1.5.0`. Cada push redeploya y pisa QA.

4. **Promoción a `master`** — por pull request, con **merge commit**:

   ```bash
   gh pr create --base master --head release/1.5.0 --title "release 1.5.0"
   ```

   En la interfaz: esperar a que `verify` y `e2e` estén en verde, y mergear con **Create a merge commit** (no *Squash*, no *Rebase*). Después:

   ```bash
   git checkout master && git pull
   git tag v1.5.0
   git push origin v1.5.0
   ```

   El merge dispara el deploy automático a `prod`.

   **Tres cosas que conviene entender de este paso:**

   - **Por qué merge commit y no las otras dos opciones.** De las tres que ofrece GitHub, solo *Create a merge commit* conserva tal cual los commits que pasaron por QA. *Squash* los colapsa en uno nuevo y *Rebase* los reescribe con otro identificador, así que el tag estaría marcando código que nunca existió en QA.
   - **El merge commit no es ruido, es el marcador del release.** `git log --first-parent master` da una línea por release, y el pull request queda como acta de qué entró.
   - **Qué reemplazó al `--ff-only`.** Antes este paso era `git merge --ff-only` + `git push`, y el valor de `--ff-only` era que **fallaba** si `master` había avanzado por otro lado. Esa alarma ahora la da GitHub: si la rama de release quedó desactualizada, el merge no se habilita hasta que la actualices.

5. **Sync de vuelta a `develop`** — **después** de promover a `master`, nunca antes (ver la nota de abajo): si hubo bugfixes en `release/1.5.0` durante la estabilización, `develop` los necesita (si no, el próximo release cortado desde `develop` los pierde):
   ```bash
   git checkout develop
   git merge release/1.5.0
   git push origin develop
   ```
   Este sí puede ser un merge commit real (`develop` probablemente avanzó con features nuevos mientras tanto) — es el único merge aceptado en todo el flujo, y cae en `develop`, nunca en `master`.

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
