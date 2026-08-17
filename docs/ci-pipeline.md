# Pipeline de CI

Qué job hace qué, cuándo corre cada uno, y por qué está armado así. Para "cómo lo modifico" o el detalle de cada trampa, ver los comentarios dentro de cada archivo — esto es el mapa general.

## `ci.yml` — el portón automático

Corre en cada `pull_request` y en push a `develop`, `master` y `release/**`.

```
push a PR / develop / master / release/**
              │
   ┌──────────┼──────────────┬───────────────┐
   ▼          ▼               ▼              ▼
verify   test-integration    e2e   dependency-audit    ← los cuatro EN PARALELO
   │          │               │              │
   └──────────┴───────┬───────┴──────────────┘
                       ▼
            deploy-backend / deploy-web   ← solo en push a master/release
```

| Job | Qué hace | Cuándo importa que falle |
|---|---|---|
| `verify` | `nx affected -t lint test build` — lint, tests rápidos (mockeados) y build, solo de lo que cambió. Calcula además qué proyectos son "desplegables" (`deployable`, usado por los dos jobs de deploy). | Gate principal: código que no compila o rompe un test no debería llegar a ningún lado. |
| `test-integration` | Levanta DynamoDB Local en Docker (reusa `npm run e2e:db:up` de más abajo) y corre los tests de `room-repository.ts` contra la base real, no contra un mock. | Detecta bugs en las queries (expresiones de clave, `begins_with`) que `verify` no puede ver porque sus tests mockean el SDK. |
| `e2e` | Levanta `web` + `realtime-api` de verdad y corre Playwright — un usuario real usando la app en un navegador. | El único que prueba el sistema completo integrado, no una pieza aislada. |
| `dependency-audit` | `npm audit --audit-level=critical` sobre el `package-lock.json` de la raíz — el árbol completo, no lo que el PR afectó (no usa `nx affected`). | Detecta una vulnerabilidad crítica en la cadena de dependencias. `high`/`moderate`/`low` quedan en el log como aviso, sin fallar el job (Fase 5.2 del roadmap; el porqué del umbral está en `openspec/changes/audit-dependencies-in-ci/design.md`). |
| `deploy-backend` | Despliega `realtime-api` (prod si es `master`, qa si es `release/*`). Depende de `verify`, `e2e`, `test-integration` y `dependency-audit`; se acota además a que `realtime-api` esté en la lista de `deployable`. | Nada se despliega si alguno de los cuatro falló. |
| `deploy-web` | Despliega `web` a GitHub Pages, solo desde `master`. Depende de `verify`, `e2e` y `dependency-audit` (no de `test-integration`, no toca el backend). | Igual que arriba. |

**Por qué `verify`/`test-integration`/`e2e`/`dependency-audit` corren en paralelo, no en serie**: el tiempo total del pipeline es el del job más lento, no la suma de los cuatro. Si `test-integration` (que necesita levantar Docker) corriera antes de `verify`, el feedback de "¿compila? ¿pasan los tests rápidos?" tardaría más sin necesidad.

**Por qué `test-integration` y `e2e` a veces terminan en verde sin correr nada**: los dos calculan su propio alcance con `nx show projects --affected --with-target <target>`. Si el cambio no toca nada relacionado, el job igual arranca, no hace nada, y termina en verde — a propósito. La alternativa (un `if:` a nivel de job) dejaría a `deploy-backend`/`deploy-web` en `skipped` en cascada cada vez que el cambio no tocara esos targets, y un deploy que no corre sin que nada quede en rojo es peor que un job que corrió de más.

**Por qué `dependency-audit` no calcula ningún alcance**: a diferencia de los otros tres, no usa `nx affected`. Una vulnerabilidad de la cadena de dependencias no es "afectada" por proyecto — vive en el árbol instalado completo, sea cual sea el archivo que cambió el PR. Corre siempre, sobre el `package-lock.json` de la raíz entero. `apps/mobile` tiene su propio lockfile, separado, y queda fuera de este job.

**Checks obligatorios para mergear un PR** (branch protection, Fase 1.3 del [hardening roadmap](hardening-roadmap.md)): `verify` y `e2e`. Los jobs de deploy nunca son obligatorios — quedan `skipped` en todo PR, y exigirlos dejaría el botón de merge esperando un resultado que nunca llega. `dependency-audit` tampoco es obligatorio para mergear (decisión de la Fase 5.2, ver su `design.md`): gatea el deploy automático, no el merge.

## Qué corre según qué cambies

`nx affected` decide a nivel de **proyecto**, no de archivo ni de test individual. Se puede simular sin tocar nada con `npx nx show projects --affected --files=<ruta>` (o `--uncommitted` para lo que ya está en el working tree). Tres casos reales, verificados así:

**Solo documentación** (`docs/*.md`):

```
$ npx nx show projects --affected --uncommitted --json
[]
```

Cero proyectos afectados — `docs/` no pertenece a ningún proyecto, y no está en `sharedGlobals` de `nx.json` (que hoy solo tiene `ci.yml`: el único archivo que, si cambia, marca *todo* como afectado). `verify`, `test-integration` y `e2e` arrancan igual, cada uno calcula su alcance, encuentra cero proyectos, y terminan en verde en segundos sin correr nada. `dependency-audit` no calcula alcance —no usa `nx affected`— así que corre igual el `npm audit` completo, sin importar que el cambio sea solo documentación.

**Un cambio en `apps/web/src/app/pages/home/home.html`** (la pantalla de entrada):

```
$ npx nx show projects --affected --files=apps/web/src/app/pages/home/home.html --json
["web","e2e"]
```

`web` porque el archivo es suyo. `e2e` porque su `project.json` declara `implicitDependencies: ["web", "realtime-api"]` — un enganche manual, no del grafo de imports, puesto ahí a propósito porque los e2e prueban `web` sin importar nada de su código. `realtime-api` **no** se afecta — nada en el grafo conecta `web` con el backend.

Por job:
- `verify` corre `web:lint`, `web:test`, `web:build`, y `e2e:lint` (tiene ese target). `e2e` no tiene `test` ni `build`, así que ahí no pasa nada.
- `test-integration`: `--with-target test-integration` da `[]` (solo `realtime-api` tiene ese target) → corre, no hace nada, verde.
- `e2e`: `--with-target e2e` da `["e2e"]` → este job sí hace algo de verdad.
- `dependency-audit`: corre igual, sin importar el archivo — no calcula alcance.
- `deploy-web` pasa a tener `web` en su lista de `deployable` — pero solo despliega de verdad en push a `master`; en un PR queda `skipped` igual que siempre.

**La pregunta clave: ¿corren todos los tests del proyecto, o solo los relacionados con lo que cambió?**

**Todos los del proyecto — no hay acotamiento por archivo ni por test.** `web:test` corre la suite Vitest completa de `web` (hoy 3 specs: `app.spec.ts`, `card.spec.ts`, `reveal-panel.spec.ts` — y ninguno prueba `home.ts`, es justo el hueco anotado como Fase 2.4 del roadmap). El job `e2e` corre `nx e2e e2e`, las 13 specs completas, en serie — no existe una forma de decirle "corré solo las que tocan la pantalla de entrada". Sí existe una función de Nx para *dividir* el e2e por archivo entre agentes en paralelo (los targets atomizados `e2e-ci--*.spec.ts` que aparecen en `nx show project e2e`), pero es para **distribuir** la corrida entre máquinas, no para **acotarla** al cambio — y este `ci.yml` ni siquiera la usa (corre el target sin atomizar, `nx e2e e2e`).

## Los otros tres workflows

| Archivo | Cuándo corre | Para qué |
|---|---|---|
| `deploy-backend.yml` | Solo manual (`workflow_dispatch`) | Rollback o desplegar un tag/commit viejo a mano. A propósito no verifica la rama actual: cuando se despliega algo viejo, no corresponde re-verificar el código de hoy. |
| `deploy-web.yml` | Solo manual | Lo mismo, para `web`. |
| `build-mobile.yml` | Builds de la app Expo | Independiente del resto — mobile no pasa por `ci.yml`. |

`ci.yml` es todo lo que corre solo, automáticamente, para verificar y desplegar. Los dos `deploy-*.yml` manuales son el camino de emergencia, separado a propósito para no mezclar los dos flujos.
