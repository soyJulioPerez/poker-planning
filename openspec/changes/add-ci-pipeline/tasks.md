# Tareas — Portón de CI con el deploy encadenado

> **El orden importa.** Los grupos 1 y 2 son prerrequisitos: sin ellos el gate nace roto
> y `nx affected` no se puede probar en local antes de escribirlo en el YAML.
>
> **Antes de cada grupo, `git status` limpio.** El grupo 1 corre un generador y el 2 un
> executor que ya demostró ensuciar el árbol de trabajo.

## 1. Mobile: que `build` deje de llamar a la nube

- [x] 1.1 Confirmar el punto de partida: `npx nx show project mobile --json` y verificar que `build` usa `@nx/expo:build`.
- [x] 1.2 ~~Correr `npx nx g @nx/expo:convert-to-inferred`~~ → **no aplica**. El generador devuelve `Could not find any targets to migrate` porque `apps/mobile/project.json` tiene `"targets": {}`: todo ya es inferido por el plugin. En su lugar, renombrar en `nx.json` los targets del plugin de expo: `buildTargetName: "eas-build"` y `exportTargetName: "build"`. Ver `design.md`, Decisión 1.
- [x] 1.3 Confirmar que el diff se limita al bloque del plugin de expo en `nx.json`.
- [x] 1.4 Verificar que `npx nx build mobile` **bundlea local**: produce `.hbc` para android e ios más el bundle web bajo `apps/mobile/dist`, sin pedir `EXPO_TOKEN` ni contactar Expo.
- [x] 1.5 Verificar que después de correr el build, `git status` no muestra `apps/mobile/package.json` ni `apps/mobile/package-lock.json` modificados. Era el efecto colateral del executor viejo.
- [x] 1.6 Confirmar que el build de EAS sigue disponible con otro nombre de target, y que `build-mobile.yml` —que invoca el CLI de `eas` directamente, sin pasar por Nx— sigue funcionando igual.

## 2. `defaultBase`

- [x] 2.1 Confirmar que hoy falla: `npx nx affected -t lint` sin argumentos debe dar error de revisión de git.
- [x] 2.2 Agregar `"defaultBase": "develop"` a `nx.json`.
- [x] 2.3 Confirmar que ahora corre sin `--base` y lista proyectos coherentes con la rama actual.

## 3. El workflow de CI

- [x] 3.1 `npx nx generate ci-workflow --ci=github` y revisar qué generó antes de tocarlo.
- [x] 3.2 Podar las líneas de Nx Cloud (`nx-cloud start-ci-run`, `npx nx-cloud fix-ci`): este workspace no tiene `nxCloudId` ni token.
- [x] 3.3 Ajustar `node-version` a **24**. El generador pone 22 y los workflows existentes usan 20, que ya está deprecado.
- [x] 3.4 Confirmar que el checkout lleva `fetch-depth: 0` **y** `filter: tree:0`.
- [x] 3.5 Confirmar que usa `nrwl/nx-set-shas@v4`.
- [x] 3.6 Confirmar que los triggers son `pull_request` y push a `develop`, `release/**` y `master`.
- [x] 3.7 Agregar `--outputStyle=static` al comando de Nx: el default reescribe líneas y deja los logs de Actions ilegibles.
- [x] 3.8 Agregar `concurrency` con `cancel-in-progress: true`. Sin eso, tres pushes seguidos a una rama corren tres pipelines completos.

## 4. Targets de deploy y jobs condicionales

- [x] 4.1 Agregar un target `deploy` a `apps/realtime-api/project.json` con `dependsOn: ["build"]`, que ejecute `sam build` y `sam deploy --config-env <ambiente>`. El ambiente se resuelve por variable, no hardcodeado.
- [x] 4.2 Agregar un target `deploy` a `apps/web/project.json` con `dependsOn: ["build"]`, que haga el build con `--base-href` y `--configuration=aws` **y el `cp` del `404.html`**. Ese `cp` hoy vive suelto como step del workflow, invisible para quien buildee `web` a mano.
- [x] 4.3 En `ci.yml`, hacer que el job `verify` exponga como **output** la lista de proyectos afectados (`nx show projects --affected --with-target deploy`). Se calcula una sola vez y lo consumen los dos jobs de deploy.
- [x] 4.4 Agregar el job `deploy-backend` a `ci.yml`: `needs: verify`, con `if:` que exija que `realtime-api` esté afectado **y** que la rama sea `master` o `release/**`. Incluye el paso de credenciales OIDC y `setup-sam`.
- [x] 4.5 Agregar el job `deploy-web` a `ci.yml`: `needs: verify`, con `if:` que exija que `web` esté afectada **y** que la rama sea `master`. Los pasos de `upload-pages-artifact` y `deploy-pages` van acá; el build y el `cp` los hace el target.
- [x] 4.6 **Si `web` no está afectada, no debe correr ni el build, ni la subida, ni el deployment.** Dejar que los jobs corran siempre argumentando idempotencia **no** es una salida aceptable: el requisito es que no se reejecute sin cambios (ver `design.md`, Open Questions).
- [x] 4.7 Reducir `deploy-backend.yml` a **solo `workflow_dispatch`**: se le quitan el trigger de `push` y el filtro `paths`. Conservar intactos sus inputs de `environment` y `ref`.
- [x] 4.8 Reducir `deploy-web.yml` a **solo `workflow_dispatch`**.
- [x] 4.9 Verificar que el camino manual **no** corre la verificación. Al desplegar un tag viejo para rollback, se despliega ese tag y nada más — verificar el código actual de la rama sería incorrecto.

## 5. Verificación local

- [x] 5.1 `npx nx affected -t lint test build --base=<algo> --outputStyle=static` con un cambio acotado a `apps/web`: confirmar que **no** corre nada de `realtime-api` ni `mobile`.
- [x] 5.2 Lo mismo tocando `packages/shared-contracts`: confirmar que **sí** corre `web`, `mobile` y `realtime-api`.
- [x] 5.3 Lo mismo tocando solo `docs/`: confirmar que no corre ninguna tarea (el único afectado es el proyecto raíz, que no tiene targets).
- [x] 5.4 `npx nx run-many -t lint test build --all` completo en verde, ahora **incluyendo mobile**, que después del grupo 1 ya se puede buildear sin la nube.

## 6. Verificación en GitHub

> Lo anterior prueba que los comandos son correctos. Esto prueba que el pipeline lo es.

### Primera corrida real — PR #3 a `develop` (run 31490462624)

```
✓ verify          success (2m47s)
- deploy-backend  skipped
- deploy-web      skipped
```

`nx-set-shas@v5` seteó `NX_BASE`/`NX_HEAD` y Nx los tomó. Los dos deploys se saltearon
por ser un PR — el `if:` de rama funciona.

**Hallazgo**: la anotación de Node 20 **siguió apareciendo** pese a `node-version: 24`.
Son cosas distintas: `node-version` controla el Node de los scripts; la anotación la
disparan las **actions mismas** según su versión mayor. Se corrigió subiendo
`actions/checkout` y `actions/setup-node` a `@v5` en `ci.yml`, que son los primeros
majors sobre Node 24. Ver `known-issues.md`.

Este PR toca `nx.json` y `project.json`, o sea configuración raíz: **afecta a todos los
proyectos**, así que no sirve para verificar el acotado por grafo (6.2, 6.6, 6.7). Eso
necesita un PR que toque un solo proyecto.

- [x] 6.1 Abrir un PR que toque solo `apps/web` y confirmar en el log del job que no corrieron los tests de `realtime-api`.
- [x] 6.2 Abrir un PR que toque `packages/shared-contracts` y confirmar que sí corrieron los de web, mobile y realtime-api.
- [ ] 6.3 Romper un test a propósito en un PR y confirmar que el check queda **en rojo**. Revertir.
- [ ] 6.4 Confirmar que en ese PR en rojo **no se disparó ningún deploy**. Es el punto del change.
- [x] 6.5 Confirmar que un PR de solo documentación pasa en verde sin ejecutar tareas.
- [ ] 6.6 **Push a `master` tocando solo el backend**: confirmar que corre el deploy de backend y que el job de `deploy-web` queda **skipped**, no ejecutado. Es la regresión concreta que este change corrige — hoy ese caso republica Pages (verificado en el historial de Actions: commits de solo `docs/` dispararon `deploy-web` con éxito).
- [ ] 6.7 **Push a `master` tocando solo `apps/web`**: confirmar el caso inverso — `deploy-web` corre, `deploy-backend` queda skipped.
- [x] 6.8 Disparar `deploy-backend.yml` a mano con un `ref` de un tag viejo y confirmar que despliega ese tag sin correr la verificación de la rama actual.

## 7. Documentación

- [x] 7.1 `docs/hardening-roadmap.md` — marcar la Fase 1.1 y actualizar la tabla de Estado.
- [x] 7.2 `docs/hardening-roadmap.md` — en la Fase 1.2, anotar que el e2e va a necesitar `npx playwright install` explícito (ver `known-issues.md`).
- [x] 7.3 `docs/known-issues.md` — eliminar la entrada de `nx build mobile` que borra el lockfile: queda resuelta por el grupo 1.
- [x] 7.4 `docs/known-issues.md` — actualizar la entrada de `node-version: 20`: sigue vigente para los workflows viejos, pero el nuevo nace en 24.
- [x] 7.5 `docs/conventions.md` — documentar que el deploy se dispara por el grafo de Nx y no por filtros de ruta, para que nadie agregue un `paths:` "por las dudas".
- [x] 7.6 `docs/local-dev-workflow.md` — revisar la sección de mobile: hoy documenta `npx nx export mobile` como el chequeo local de bundle. Después de `convert-to-inferred` ese target puede haber cambiado de nombre; ajustar al que quede, o pasar a `nx build mobile` si es el que bundlea local.
- [x] 7.7 `docs/local-dev-workflow.md` — agregar cómo reproducir en local lo que corre el gate: `npx nx affected -t lint test build`, que ahora funciona sin `--base` gracias a `defaultBase`. Es la forma de no descubrir un fallo recién en el PR.
- [x] 7.8 `docs/local-dev-workflow.md` — aclarar que los targets `deploy` **no son para uso local**: existen para que `nx affected -t deploy` acote qué se despliega desde CI. En local el equivalente es levantar la app en `localhost`.

## 8. Cierre

- [x] 8.1 Confirmar que el diff no toca ningún archivo bajo `src/`. Este change es de pipeline y configuración.
- [x] 8.2 Confirmar que los tres ambientes de backend siguen desplegables a mano por `workflow_dispatch`.
- [ ] 8.3 `/opsx:verify` y después `/opsx:archive`.


### Verificación en vivo — resultados

| Tarea | Run | Resultado |
|---|---|---|
| 6.2 acotado por grafo | 31493858968 | PR tocando solo `shared-contracts`: **15 tareas en 5 proyectos** (shared-contracts, room-client-runtime, web, mobile, realtime-api). `e2e` afuera, correcto. Y `mobile:build` corrió **sin tocar EAS**. |
| deploy a qa | 31494242265 | Push a `release/1.1.0`: `nx deploy realtime-api --configuration=qa` **success**. Primera corrida del target nuevo. `deploy-web` skipped por la condición de rama. |
| deploy a prod | 31494729811 | Promoción a `master` con tag `v1.1.0`: `--configuration=prod` **success** y Pages publicado (HTTP 200). |

**Regresión encontrada y corregida durante la promoción**: al pasar `deploy-backend.yml` a solo
`workflow_dispatch` se renombró el workflow, lo que rompió los cuatro `gh workflow run "Deploy
backend to AWS"` que la documentación invocaba por display name. Se cambiaron a invocar por
nombre de archivo (`deploy-backend.yml`), que es estable ante renombres.


### Bug encontrado en la verificación en vivo: `nx-set-shas` sin rama base

Un commit de **solo documentación** en `release/1.1.0` disparó un deploy de backend a qa
(run 31495249129). No debía: nada del backend había cambiado.

```
NX_BASE: 4b825dc642cb6eb9a060e54bf8d69288fbee4904   ← hash del árbol vacío de git
Successfully ran targets lint, test, build for 6 projects
```

**Causa**: el input `main-branch-name` de `nrwl/nx-set-shas` tiene default `main`, rama
que no existe en este repo. Sin encontrarla, la action cae al árbol vacío y `affected`
marca **todos** los proyectos.

Es la misma causa raíz que el `defaultBase` de `nx.json` —Nx y sus actions asumen `main`—
pero en un lugar distinto y con peores consecuencias: en un pipeline con deploys significa
desplegar producción sin que haya cambiado nada.

**Corregido** pasando `main-branch-name: develop`. Verificado en el run 31495672524:
`NX_BASE` pasó a ser un commit real (`9105e5f`) y desaparecieron las ocurrencias del
árbol vacío.

**Sin la insistencia en probar el caso "sin cambios no se redespliega", este bug habría
llegado a producción disfrazado de comportamiento normal.**


### Bug encontrado en la verificación en vivo: el rollback manual no podía usar el target de Nx

Probar la tarea 6.8 (`workflow_dispatch` con `ref=v1.0.0`) falló **dos veces**, por dos
causas distintas:

**1. `spawn sh ENOENT`** (run 31497033081). El step traía `env: PATH: ${{ github.workspace }}/node_modules/.bin:${{ env.PATH }}`.
`${{ env.PATH }}` no resuelve al PATH del runner sino al contexto `env` del workflow, que
está vacío — el PATH quedaba en `node_modules/.bin:` y `npx` no encontraba ni `sh`. El
linter del IDE lo había marcado como *"Context access might be invalid: env"*. Corregido
extendiendo el PATH con `GITHUB_PATH`, que es la forma documentada.

**2. `Cannot find configuration for task realtime-api:deploy`** (run 31497440548). Este es
de diseño, no de sintaxis.

El workflow hace checkout de un **ref arbitrario** — típicamente un tag anterior, para
rollback. Ese código puede no tener el target `deploy`: se agregó en `v1.1.0`, así que
`nx deploy` falla en cualquier ref previo. **El camino manual tiene que ser agnóstico a la
versión que despliega**, y `sam build`/`sam deploy` lo son.

Es la contracara del acierto de la Decisión 2: convertir el deploy en target de Nx es
correcto para el camino automático, que siempre despliega el código actual. Para el camino
de rollback es exactamente lo contrario.

Verificado tras la corrección: run 31497873506, `v1.0.0` desplegado a `dev`, success.

### Estado de 6.6 y 6.7 — no verificadas

Requieren un push a `master` donde **solo un** proyecto resulte afectado. Los tres pushes a
`master` de esta sesión cambiaron `ci.yml`, que está en `sharedGlobals` y por diseño
invalida todos los proyectos — así que ambos deploys corrieron, correctamente.

Lo que sí quedó demostrado del mecanismo de acotado:

| Evidencia | Run |
|---|---|
| PR de `shared-contracts`: 5 proyectos, `e2e` afuera | 31493858968 |
| `release/**`: `deploy-web` skipped | 31494242265 |
| `develop`: ambos deploys skipped | (push de sync) |
| Local: `docs/` → `[]` deployables | tarea 5.3 |

Falta ver el `if:` de `affected` evaluando en falso **sobre master**. Se va a verificar solo
en el primer release que toque un solo lado del producto.
