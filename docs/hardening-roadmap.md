# Roadmap de hardening del repositorio

Plan de implementación progresiva de los huecos detectados en la revisión del repo. Cada ítem es una unidad de trabajo independiente con criterio de aceptación propio.

## Cómo usar este documento

- **Cada fase = un change de OpenSpec.** Antes de escribir código, `/opsx:propose` con el alcance de la fase. Los criterios de aceptación de abajo son el borrador de sus `tasks.md`.
- **Las fases están ordenadas por dependencia y por valor.** No saltear la Fase 1: casi todo lo demás se cuelga del pipeline de CI.
- **Marcar el progreso** en la tabla de abajo a medida que se avanza.
- **Consultar los `PLUGIN.md` de Nx antes de cada fase que toque testing.** Varios plugins traen guía de buenas prácticas propia, y en este workspace están instalados los que más importan para las Fases 1 y 2: `node_modules/@nx/jest/dist/PLUGIN.md`, `@nx/playwright/dist/PLUGIN.md`, `@nx/vitest/dist/PLUGIN.md` y `@nx/vite/dist/PLUGIN.md`. No todos los plugins tienen este archivo; si no está, seguir sin él.

## Estado

| # | Fase | Estado | Depende de |
|---|---|---|---|
| 1 | [Portón de CI](#fase-1--portón-de-ci) | ✅ Completa | — |
| 2 | [Tests del backend](#fase-2--tests-del-backend) | 🟡 2.1 hecha · 2.2 y 2.3 pendientes | 1 |
| 3 | [Higiene del workspace](#fase-3--higiene-del-workspace) | 🟡 3.1 hecha · 3.2 y 3.3 pendientes | 1 |
| 4 | [Observabilidad](#fase-4--observabilidad) | ⬜ Pendiente | — |
| 5 | [Seguridad y supply chain](#fase-5--seguridad-y-supply-chain) | ⬜ Pendiente | 1 |
| 6 | [Confianza en el deploy](#fase-6--confianza-en-el-deploy) | ⬜ Pendiente | 1, 4 |
| 7 | [Release y colaboración](#fase-7--release-y-colaboración) | ⬜ Pendiente | 1 |

---

## Fase 1 — Portón de CI

### El problema

Los tres workflows en `.github/workflows/` son **todos de deploy**. Ninguno corre `lint`, `test` ni `e2e`. Un push a `master` dispara `sam deploy` sin que se haya ejecutado una sola prueba, y los tres specs de Playwright en `e2e/` solo corren si alguien se acuerda de correrlos a mano — o sea, se van a pudrir.

Además el repo nunca usa `nx affected`, que es la razón técnica principal para tener un monorepo: sin él, o se corre todo siempre (lento) o no se corre nada (lo que pasa hoy).

### 1.1 — Workflow de CI en pull requests ✅

> **Hecha** el 2026-08-11, change `add-ci-pipeline`. Lo que quedó distinto de lo que este documento anticipaba:
>
> - **El deploy quedó dentro de `ci.yml`, no en workflows separados.** Un `ci.yml` suelto habría corrido *en paralelo* con los deploys, no antes: el check se ponía rojo después de que prod ya se había actualizado. Ahora `deploy-backend` y `deploy-web` son jobs con `needs: verify` y un `if:` acotado por el grafo.
> - **`deploy-backend.yml` y `deploy-web.yml` quedaron solo con `workflow_dispatch`**, para rollback y despliegue manual de ambientes. El camino manual no debe verificar la rama actual: cuando desplegás un tag viejo, ese tag es lo que va.
> - **`deploy-web.yml` no tenía filtro de rutas.** Republicaba Pages en cada push a `master`, incluso en commits de solo `docs/` — verificado en el historial de Actions. Ahora depende del grafo.
> - **`nrwl/nx-set-shas@v5`**, no v4: es lo que emite el generador de Nx.
> - **`convert-to-inferred` no aplicaba**: los targets de mobile ya eran inferidos. Se resolvió renombrando los del plugin (`buildTargetName: "eas-build"`, `exportTargetName: "build"`).

Crear `.github/workflows/ci.yml` que corra en `pull_request` y en push a `develop`, `release/**` y `master`.

**Prerrequisito: arreglar el target `build` de mobile**

Antes de escribir el YAML hay que resolver esto, o el gate nace roto. Hoy `nx build mobile` usa el executor `@nx/expo:build`, que **no compila nada localmente**: invoca `eas build`, o sea un build en los servidores de Expo (cuota, minutos, `EXPO_TOKEN`). Y como `packages/shared-contracts` es dependencia de mobile, cualquier PR que la toque lo dispara.

Peor: ese executor **corrompe el working tree aunque falle** — borra `apps/mobile/package-lock.json` y reescribe `apps/mobile/package.json`. Ver [known-issues.md](known-issues.md). En CI el daño es efímero, pero en local no.

**Solución: correr el generador oficial** en vez de renombrar targets a mano.

```bash
npx nx g @nx/expo:convert-to-inferred
```

El propio executor lo recomienda al correr (`@nx/expo:build` está deprecado y se elimina en Nx v24). Resuelve la deprecación y la nomenclatura de una vez.

El criterio para saber si quedó bien: **`nx build mobile` tiene que bundlear local, no llamar a la nube.** El equivalente local es `expo export`, que produce bytecode Hermes para android e ios más el bundle web —verificación real de que la app compila en las tres plataformas— y tarda ~63s. El `eas build` es conceptualmente un *deploy*, no un build: va con los workflows de despliegue (`build-mobile.yml`, que ya lo invoca por CLI y no usa el target de Nx), no en el gate de PRs.

**Qué hacer**

- Job único que corra `npx nx affected -t lint test build`.
- Para que `affected` sepa contra qué comparar, usar `nrwl/nx-set-shas@v4` (calcula el SHA base correcto en PRs y en push). Sin eso, `affected` en CI o falla o compara contra el commit anterior, que no es lo que se busca.
- `npm ci` + `actions/setup-node@v4` con `cache: npm`, igual que los workflows existentes.
- `fetch-depth: 0` en el checkout — `affected` necesita historia de git, y el default (`depth: 1`) la rompe.
- Definir `"defaultBase": "develop"` en `nx.json`. Hoy no está, y Nx cae a `main`, que no existe en este repo: `nx affected` sin `--base` **falla en local**. En CI lo tapa `nx-set-shas`, pero sin esto no podés probar el comando antes de pushearlo.

Antes de escribir el YAML, verificar localmente qué considera "afectado" el workspace:

```bash
npx nx show projects --affected --base=HEAD~3   # qué proyectos considera afectados
npx nx graph --base=HEAD~3                      # el grafo, visualmente
```

**Costo medido** (este workspace, cache limpia, corridas verificadas con exit 0):

| Target | Proyectos | Tiempo |
|---|---|---|
| `lint` | 6 | 29s |
| `test` | 5 | 14s |
| `build` | 4 (sin mobile) | 9s |
| `export` mobile | 1 | 63s |

El gate completo está en el orden de **~2 minutos**, y mobile es más de la mitad. Con esos números, el job único alcanza: dividir no compra nada todavía. Revisarlo si el gate pasa de ~5 minutos.

**Criterio de aceptación**

- [ ] Un PR que toca solo `apps/web` no corre los tests de `realtime-api` (verificable en el log del job).
- [ ] Un PR que toca `packages/shared-contracts` sí corre los tests de web, mobile y realtime-api (es dependencia de los tres).
- [ ] Un PR con un test roto deja el check en rojo.

**Trampas**

- **El prerrequisito de lint ya está resuelto.** `nx lint` estuvo rojo por dos causas distintas, y las dos se cerraron:

  | Causa | Errores | Resuelto en |
  |---|---|---|
  | `@nx/enforce-module-boundaries` | ~~30~~ → **0** | Fase 3.1 — change `enable-module-boundaries` |
  | `@angular-eslint/template` | ~~2~~ → **0** | change `fix-room-ui-accessibility` |

  `nx run-many -t lint --all` pasa en los 6 proyectos. `lint` puede entrar al gate sin que los PRs nazcan en rojo.

- **Playwright necesita `npx playwright install` en CI.** `npm ci` instala la librería pero no los navegadores; sin ese paso los e2e fallan con `Executable doesn't exist`, que no dice nada sobre la causa. Aplica sobre todo a la Fase 1.2, pero conviene tenerlo presente si el gate de 1.1 llega a tocar `e2e`. Ver [known-issues.md](known-issues.md).
- `nx graph` **no** tiene flag `--affected`, a diferencia de `nx show projects`. En `nx graph` el modo afectado se activa pasando `--base`/`--head`. Conviene confirmar toda flag de Nx con `--help` (o `nx_docs`) antes de meterla en un YAML de CI, donde el error tarda un push en aparecer.
- El caché de Nx local no se comparte con CI. Sin remote cache, CI recompila todo cada vez. Está bien para empezar; si el pipeline se pone lento, ahí se evalúa Nx Cloud o un caché self-hosted — no antes.
- Pasar `--outputStyle=static` en CI. El default (TUI dinámico) reescribe líneas y deja los logs de GitHub Actions ilegibles; `static` es el modo que Nx recomienda explícitamente para CI (`npx nx affected --help`).

### 1.2 — E2E en CI ✅

> **Hecha** el 2026-08-11, change `add-e2e-to-ci`. Lo que quedó distinto de lo que este documento anticipaba:
>
> - **Se eligió la opción 2, no la 1.** Este documento recomendaba orquestar desde el YAML por simplicidad. La recomendación se invirtió al descubrir que ninguna de las dos apps necesita `nx serve`: `web` se sirve con `http-server` sobre `dist/`, y `realtime-api` es un `ws` plano al que le alcanza `node`. El modo `E2E_TARGET=ci` se reproduce en local con `npm run test:e2e:ci`.
> - **El comando del `webServer` no puede empezar con `nx`.** El plugin infiere un `dependsOn` de lo que encuentra ahí y termina invocando la misma tarea dos veces. Con `nx run web:serve-static` pasó **ocho corridas seguidas** antes de fallar: `reuseExistingServer` tapa el conflicto cuando Playwright encuentra el puerto ya atendido. Lección de método: un fallo intermitente no se descarta acumulando corridas verdes.
> - **El job de e2e no lleva `if:` a nivel de job.** En GitHub Actions un job salteado arrastra a sus dependientes, así que un `if:` ahí habría apagado los deploys en silencio. Calcula su alcance adentro y termina en verde sin trabajo. Como resultado los `if:` de los deploys quedaron sin tocar: ni `always()`, ni `!cancelled()`, ni `needs.<job>.result`.
> - **Apareció un bug de la suite de 10 días de antigüedad.** Los dos tests que `known-issues.md` documentaba como "inestables, sin causa raíz" eran el mismo problema: el page object escribía el nombre en el formulario equivocado, aprovechando que Angular zoneless *agenda* la detección de cambios. Los dos volvieron a la suite. Y de paso apareció una carrera real en el emulador local del backend, que dejaba participantes "conectados" para siempre.
> - **El diagnóstico costó seis corridas** porque el emulador local no logueaba nada y Playwright ignora el `stdout` de los `webServer`. La instrumentación que se agregó (logs JSON del backend, eventos del navegador, `trace: retain-on-failure`, reporter `list`) quedó permanente.
>
> Resultado: **13 tests en 14.7s, cero flaky**. Antes eran 12 activos + 1 apagado, con 8 a 12 flaky por corrida.

> **Punto de partida que dejó la 1.1** *(se conserva como registro)*: el generador de Nx emitió `npx playwright install --with-deps` y `e2e` en la lista de targets porque detecta el proyecto. Ambas cosas **se sacaron** de `ci.yml` por estar fuera del alcance de la 1.1 — pero ese es exactamente el par que hay que reponer acá. Sin el `playwright install`, los e2e fallan con `Executable doesn't exist`, que no dice nada sobre la causa (ver [known-issues.md](known-issues.md)).
>
> Y sigue abierto lo que ya estaba anotado: `e2e` **no depende de `web` en el grafo**, así que `nx affected` no lo marca cuando cambia la web. Si el job se resuelve por `affected` sin arreglar eso, no va a correr casi nunca.

**Qué hacer**

Los e2e necesitan tres cosas arriba: DynamoDB Local, `realtime-api` y `web`. Hoy [e2e/playwright.config.mts](e2e/playwright.config.mts) **no orquesta nada** en modo `local` — asume que ya están corriendo. El comentario del archivo explica por qué (poner `nx serve` dentro de `webServer.command` choca con el `dependsOn` que infiere el plugin de Nx/Playwright: *"recursive task invocation detected"*).

Dos caminos; elegir uno y dejar registrada la decisión en el `design.md` del change:

1. **Orquestar desde el YAML**: levantar DynamoDB Local con `services:` de GitHub Actions (o el `npm run e2e:db:up` que ya existe), arrancar api y web en background, esperar a que respondan, y recién ahí `nx e2e e2e`.
2. **Agregar un `E2E_TARGET=ci`** al config de Playwright que sí use `webServer` con los binarios ya buildeados (no `nx serve`), esquivando el conflicto de tasks recursivas.

La opción 1 es más simple de arrancar; la 2 deja el repo reproducible en local con un solo comando. Recomendación: arrancar con la 1 y migrar a la 2 si mantener el YAML se vuelve molesto.

**Criterio de aceptación**

- [x] Los 3 specs corren en CI y pasan.
- [x] Un e2e roto deja el PR en rojo.
- [x] En caso de fallo, el trace de Playwright queda subido como artifact (`actions/upload-artifact`) — `trace: 'on-first-retry'` ya está configurado, pero sin subir el artifact no se puede ver.
- [x] El job de e2e no bloquea el feedback rápido: separado del job de lint/test, no en serie con él.

### 1.3 — Branch protection ✅

> **Hecha** el 2026-08-13, change `enable-branch-protection`. Lo que quedó distinto de lo que este documento anticipaba:
>
> - **Los checks obligatorios son dos, no uno.** `verify` y `e2e`. Y los de deploy (`deploy-backend`, `deploy-web`) **no** se marcan: aparecen como `Skipped` en todo pull request, y exigirlos dejaría el botón de merge gris esperando un resultado que nunca llega.
> - **"Require linear history" quedó descartada.** Este documento la sugería para `master` por analogía con el `--ff-only`. Prohíbe el merge commit de la promoción, que es lo que identifica cada release en la historia. Su garantía real —fallar si `master` avanzó por otro lado— la da *"Require branches to be up to date before merging"*.
> - **La promoción a `master` dejó de ser un push.** Pasa a ser un pull request desde `release/*` con **Create a merge commit**, y el tag va después sobre ese merge. `git merge --ff-only` + `git push origin master --tags` ya no es posible.
> - **Las aprobaciones requeridas quedaron en 0.** GitHub no permite aprobar el propio pull request, y hoy hay una sola persona con acceso de escritura: con 1, ningún pull request se podría mergear. **Sube a 1 en cuanto entre la segunda persona** — es lo primero a cambiar, no una duda pendiente.
> - **`release/*` no se protege.** Ahí caen los fixes de estabilización, donde la ceremonia de un pull request cuesta más de lo que aporta. Nada llega a producción sin pasar por el pull request a `master`.
>
> Se usó protección clásica y no *rulesets*. La única limitación: qué botones de merge aparecen se configura por repositorio y no por rama, así que "Squash en `develop`, Merge commit en `master`" queda como convención escrita y no forzada.


[docs/git-branching-strategy.md](git-branching-strategy.md) dice explícitamente: *"no hay branch protection rules configuradas todavía"*. La convención existe solo en la cabeza de quien la sigue.

**Qué hacer**

En GitHub → Settings → Branches, para `master` y `develop`:
- Requerir que el check de CI pase antes de mergear.
- Requerir PR (no push directo).
- En `master`, considerar "require linear history" — es lo que ya se hace a mano con `merge --ff-only`.

**Criterio de aceptación**

- [x] Un push directo a `master` es rechazado por GitHub.
- [x] Un PR con CI en rojo no se puede mergear.
- [x] `docs/git-branching-strategy.md` actualizado: sacar la frase de que no hay protección y documentar qué reglas quedaron.
- [x] **Eliminar la excepción "commit directo a `develop`" de [conventions.md](conventions.md)** — está escrita con vencimiento en esta fase. A partir de acá deja de ser una decisión y pasa a ser imposible, así que la excepción sobra.

---

## Fase 2 — Tests del backend

### El problema

[apps/realtime-api/project.json](../apps/realtime-api/project.json) tiene `"passWithNoTests": true` y **no hay un solo test**. Ahí vive la lógica de dominio del producto: 10 acciones (`vote`, `reveal`, `resolve-story`, `close-room`, `next-story`, `new-round`…), el cálculo de promedio y moda, las reglas de quién puede hacer qué, y el repositorio de DynamoDB.

Los 4 tests unitarios que existen hoy están en las piezas más fáciles del repo.

### 2.1 — Unitarios de las acciones ✅

> **Primera vuelta hecha** el 2026-08-13, change `add-backend-unit-tests`. 41 tests, 39 en verde y 2 `todo` que documentan huecos encontrados. Lo que quedó distinto de lo que este documento anticipaba:
>
> - **El orden de abajo estaba mal, y el primer ítem es el error principal.** `resolve-story` **no calcula nada**: recibe `finalScore` del cliente y lo guarda. El promedio y la moda están en `reveal.ts`, en una función `computeRevealResult` que era **pura y no estaba exportada**. Se extrajo a `lib/reveal-result.ts` y se testeó sin un solo mock.
> - **`fix-mode-numeric-only` no toca el cálculo de la moda.** La moda de un grupo que votó mayoritariamente `☕` **es** `☕`, y eso es correcto. Lo que ese change agregó es que no se pueda *resolver* con ese valor, y esa defensa vive en `handleResolveStory`. Está cubierta.
> - **Lo más barato resultó ser lo que no estaba en la lista**: `maskRoomForViewer` es pura, no necesita mocks, y es la regla que hace que el planning poker funcione como juego — si se rompe, todos ven los votos antes del revelado.
> - **No hizo falta mockear el repositorio ni `broadcast`**, como sugería este documento. `broadcast.ts` ya trae una salida (`local://`) que evita hablar con API Gateway, y para DynamoDB se usó **`aws-sdk-client-mock`**, la librería estándar para el SDK v3.
> - **Se encontró un hueco de validación**: el servidor no comprueba `isVoter` al votar, aunque el spec lo exige. Ver [known-issues.md](known-issues.md).
>
> **Segunda vuelta hecha** el 2026-08-13, change `complete-backend-unit-tests`. **87 tests, 12 suites.** Lo que dejó:
>
> - **Dos guardas nuevas en `handleVote`**, que la interfaz ya cumplía y el servidor no: rechaza a quien no está habilitado como votante, y rechaza todo voto una vez revelada la ronda. La primera era conformidad con el spec; la segunda era una regla que no estaba escrita en ningún lado y se decidió acá.
> - **`join-room` resultó la de más contenido**, no las que este documento listaba: su lógica de reconexión —preservar voto, rol e ícono de quien vuelve— es exactamente lo que cubría el e2e que estuvo doce días marcado `test.fixme`. Ahora está cubierta en milisegundos.
> - **`get-room-info` entró por una razón distinta al resto**: casi no tiene reglas, pero es el único endpoint llamable **sin estar en la sala**. El test enumera las claves de la respuesta, para que agregar un campo que filtre participantes o votos rompa con ruido.
> - **Las fixtures se extrajeron** a `actions/action.fixtures.ts`, excluido del bundle en `tsconfig.app.json`. Sin eso, ocho archivos repetían cuarenta líneas de armado idénticas y cada spec escondía lo que tenía de propio.


**Qué hacer**

Empezar por las acciones con reglas de negocio puras, en este orden:

*(Orden original, corregido por la primera vuelta — se conserva como registro.)*

1. ~~**`resolve-story`** — promedio, moda, resolución manual.~~ **No calcula nada.** El cálculo está en `reveal`.
2. **`vote`** — votar dos veces, votar después del reveal, votar siendo moderador no-votante. ✅ Hecho, y las dos últimas resultaron ser huecos de validación, no reglas implementadas.
3. **`reveal`** ✅ / **`new-round`** / **`next-story`** — transiciones de estado y quién tiene permiso.
4. **`close-room`** — el resumen final.

~~Mockear el repositorio y `lib/broadcast.ts`~~ → **No hace falta.** `broadcast.ts` ya trae la salida `local://` y para DynamoDB se usa `aws-sdk-client-mock`.

**Criterio de aceptación**

- [x] Sacar `passWithNoTests: true` de `project.json` — el target debe fallar si no hay tests.
- [ ] Cada acción con lógica de decisión tiene tests de camino feliz **y** de camino de error (permiso denegado, estado inválido).
- [x] Los casos de los changes `fix-mode-numeric-only` y `tshirt-numeric-resolution` están cubiertos explícitamente.

**Trampas**

- `realtime-api` usa **Jest** (`jest.config.cts`), igual que `packages/` y `mobile`. Solo `web` usa Vitest. No mezclar convenciones.
- Evitar testear a través del handler HTTP. Los handlers (`connect`, `disconnect`, `default`) son adaptadores finos; la lógica está en `actions/`. Los tests van ahí.
- Si mockear el repositorio resulta difícil, esa dificultad es señal de acoplamiento mal puesto en el código, no de un problema del test.

### 2.2 — Test de integración contra DynamoDB Local

**Qué hacer**

Los unitarios de 2.1 mockean el repositorio, así que **no prueban que las queries a DynamoDB estén bien**. Agregar una capa fina de integración que corra `lib/room-repository.ts` contra DynamoDB Local — la infra ya existe (`npm run dev:db:up` + `npm run dev:db:create-table`).

Cubrir sobre todo el diseño single-table: PK/SK, el TTL, y las lecturas de sala completa.

**Criterio de aceptación**

- [ ] Los tests crean y limpian sus propios datos (nada de estado compartido entre tests).
- [ ] Corren en CI (misma infra que se armó en 1.2).
- [ ] Están separados de los unitarios: `nx test realtime-api` sigue siendo rápido y no necesita Docker.

### 2.3 — Cobertura con umbral

**Qué hacer**

Activar reporte de cobertura y fijar un umbral mínimo que falle el build si baja.

> **Conviene fijarlo después de la segunda vuelta de la 2.1**, no antes. El umbral se fija en el valor ya alcanzado, y con solo tres handlers cubiertos mediría poco y habría que rehacerlo.

El umbral funciona como **trinquete**: se fija en el valor ya alcanzado y solo sube. Un 80% impuesto de golpe genera tests basura escritos para el número; un umbral que sube de a poco genera cobertura real.

**Criterio de aceptación**

- [ ] `nx test realtime-api --coverage` produce reporte.
- [ ] Hay un umbral configurado, fijado en el valor ya alcanzado (no un número aspiracional).
- [ ] CI falla si la cobertura baja de ese umbral.

**Trampas**

- El workspace mezcla runners (Jest en 3 proyectos, Vitest en `web`). Agregar la cobertura de todos en un solo número es trabajo extra y poco valor — mantener el umbral **por proyecto**.

---

## Fase 3 — Higiene del workspace

Fase corta (una tarde) pero de alto retorno: hay tres configuraciones que existen y **no hacen nada**, lo que es peor que no tenerlas — dan una falsa sensación de cobertura.

### 3.1 — Tags de proyecto y module boundaries reales ✅

> **Hecha** el 2026-08-10, change `enable-module-boundaries`. Los 30 errores de `@nx/enforce-module-boundaries` bajaron a 0. El esquema de tags vigente está documentado en [conventions.md](conventions.md); el porqué de cada decisión, en el `design.md` del change.
>
> Dos matices que quedaron del cierre:
> - El eje `type:*` quedó configurado pero **no es verificable en aislamiento hoy**: las apps no tienen alias en `tsconfig.base.json`, así que importarlas dispara antes la sub-regla de rutas relativas. Se mantiene igual porque cuesta cero y deja de ser redundante en cuanto aparezca una librería nueva.
> - `nx lint` **sigue rojo en `web`** por 2 errores de accesibilidad ajenos a esta fase. Ver la trampa de la Fase 1.1.

**El problema** *(estado previo, se conserva como registro)*

[eslint.config.mjs](../eslint.config.mjs) define constraints para `scope:shared`, `scope:api` y `scope:shop`. `scope:shop` es texto de ejemplo del generador de Nx: no tiene nada que ver con esta app. Y los 5 proyectos tienen `"tags": []`. **La regla está prendida pero no aplica a nada**: hoy `apps/web` podría importar de `apps/realtime-api` y ESLint no diría una palabra.

**Qué hacer**

Definir el esquema de tags que refleje la arquitectura que **ya existe** de hecho, y hacerlo cumplir. Punto de partida sugerido:

| Proyecto | Tags propuestos |
|---|---|
| `shared-contracts` | `scope:shared`, `type:util` |
| `room-client-runtime` | `scope:client`, `type:feature` |
| `web` | `scope:web`, `type:app` |
| `mobile` | `scope:mobile`, `type:app` |
| `realtime-api` | `scope:api`, `type:app` |
| `e2e` | `scope:e2e`, `type:e2e` |

Reglas que deberían derivarse de eso: `shared-contracts` no depende de nadie; `room-client-runtime` solo de `shared`; `web` y `mobile` no se ven entre sí ni ven `api`; nadie depende de una app.

Esto convierte en mecánico el desacople web/mobile/api que se logró en el change `uncouple-client-logic` y que hoy depende solo de disciplina.

**Criterio de aceptación**

- [ ] `scope:shop` eliminado del config.
- [ ] Todos los proyectos tienen tags.
- [ ] **Verificación activa**: agregar temporalmente un `import` de `apps/realtime-api` dentro de `apps/web`, confirmar que `nx lint web` falla, y revertirlo. Una regla de boundaries que nunca se vio fallar no se sabe si funciona.

### 3.2 — `nx.json`: `release.projects` apunta a un proyecto inexistente

[nx.json](../nx.json) declara `"release": { "projects": ["api"] }`, pero no existe ningún proyecto llamado `api` — se llama `realtime-api` (`npx nx show projects` lo confirma).

**Criterio de aceptación**

- [ ] O se corrige a `realtime-api`, o se elimina el bloque `release` hasta que la Fase 7 lo necesite de verdad. Cualquiera de las dos, pero no dejarlo como está.

### 3.3 — Plugin de Docker sin Dockerfile

`nx.json` registra el plugin `@nx/docker` con `buildTarget`/`runTarget`, y `@nx/docker` está en `devDependencies`, pero **no existe ningún Dockerfile en el repo**. El backend se despliega como Lambdas vía SAM, así que probablemente el plugin sobra.

Las dependencias no usadas no son gratis: son superficie de ataque (Fase 5), ruido en el árbol de decisiones, y tiempo de instalación en cada corrida de CI.

**Criterio de aceptación**

- [ ] Decidir: o se usa (¿hay un caso? ¿el dev server local containerizado?) o se saca el plugin de `nx.json` y la dependencia de `package.json`.
- [ ] Si se saca: confirmar que `npx nx show projects` y los builds siguen funcionando.

---

## Fase 4 — Observabilidad

### El problema

Cero logging estructurado, cero alarmas, cero tracing. Hay tres ambientes reales corriendo en AWS. **Si `prod` se rompe hoy, alguien tiene que avisar para enterarse.** Es el área del ciclo de vida que falta entera.

### 4.1 — Logging estructurado

**Qué hacer**

Reemplazar los `console.log` sueltos por logs en JSON con campos consistentes: `level`, `requestId`, `connectionId`, `roomId`, `action`, `durationMs`. CloudWatch Logs Insights puede consultar JSON; texto libre no.

Empezar por los tres handlers (`connect`, `disconnect`, `default`) y por los errores de todas las acciones.

**Criterio de aceptación**

- [ ] Todos los logs del backend salen como JSON de una línea.
- [ ] Cada log de una acción incluye `roomId` y la acción, para poder reconstruir la sesión de una sala.
- [ ] Los errores loguean el stack completo y el contexto, no solo el mensaje.
- [ ] Una query de CloudWatch Logs Insights documentada en `docs/` que muestre los errores de la última hora, escrita y probada contra `dev`.
- [ ] Prueba práctica del resultado: se puede contestar *"¿qué pasó en la sala ABC123 hace 20 minutos?"* sin leer código.

### 4.2 — Alarmas en CloudWatch

**Qué hacer**

En [infra/template.yaml](../infra/template.yaml), agregar alarmas y una suscripción SNS a un email. Mínimo viable:

- Errores de Lambda > N en 5 minutos.
- Throttles de Lambda > 0.
- Errores 5xx de API Gateway.
- Duración p99 de Lambda por encima de un umbral.

**Criterio de aceptación**

- [ ] Las alarmas se crean por ambiente (una alarma de `dev` no puede despertar por un problema de `prod`).
- [ ] **Probado que dispara**: forzar un error en `dev` y confirmar que llega la notificación. Una alarma que nunca se vio disparar no existe.
- [ ] Umbrales distintos por ambiente, o `dev` genera spam hasta que alguien apaga las notificaciones — que es la forma más común en que muere el monitoreo.

### 4.3 — Tracing distribuido (opcional)

Activar AWS X-Ray en las Lambdas y el API Gateway (`Tracing: Active` en el template de SAM). Con una sola Lambda el valor es limitado.

**Criterio de aceptación**

- [ ] Se puede ver el timeline de un mensaje WebSocket: API Gateway → Lambda → DynamoDB → broadcast.
- [ ] Identificado dónde se va el tiempo en la acción más lenta.

---

## Fase 5 — Seguridad y supply chain

### El problema

~90 devDependencies, sin Dependabot ni Renovate, sin `npm audit` en CI, sin CodeQL, sin secret scanning. Eso se degrada solo: en 6 meses el salto de versiones es tan grande que actualizar se vuelve un proyecto en sí mismo.

Nota de contexto: la app no tiene autenticación por diseño (salas efímeras sin login), así que el riesgo de authz es acotado — pero el WebSocket público sin rate limiting sí es superficie real.

### 5.1 — Actualización automática de dependencias

**Qué hacer**

`.github/dependabot.yml` (o Renovate, que agrupa mejor). Configurarlo para agrupar por ecosistema — 90 PRs sueltos por semana se terminan ignorando, y un Dependabot ignorado es peor que ninguno.

**Criterio de aceptación**

- [ ] Los updates llegan agrupados (ej: todo `@nx/*` junto, todo `@angular/*` junto), con cadencia semanal, no diaria.
- [ ] El CI de la Fase 1 corre sobre esos PRs — sin eso no sirven de nada.
- [ ] Angular, Nx y Expo excluidos del agrupado automático o marcados aparte: sus majors necesitan `nx migrate` / `expo upgrade`, no un bump de `package.json`.

### 5.2 — Auditoría de dependencias en CI

**Criterio de aceptación**

- [ ] Un job que corra `npm audit --audit-level=high` (o `--production` para acotar el ruido).
- [ ] Definido explícitamente qué severidad rompe el build y cuál solo avisa. Documentado.

**Trampas**

- `npm audit` sobre devDependencies genera mucho falso positivo (una vulnerabilidad en una herramienta de build no es la misma que una en runtime). Si rompe el build por todo, en dos semanas alguien le pone `|| true` — y ahí se pierde la señal para siempre.

### 5.3 — Análisis estático y secret scanning

**Criterio de aceptación**

- [ ] CodeQL activo para JavaScript/TypeScript (workflow provisto por GitHub).
- [ ] Secret scanning + push protection activados en Settings del repo.
- [ ] Revisado que [infra/env.json](../infra/env.json) no tenga secretos commiteados y que esté en `.gitignore` (existe `env.json.example`, así que la intención está — confirmar que se cumple).

---

## Fase 6 — Confianza en el deploy

### 6.1 — Smoke test post-deploy

**El problema**

[deploy-backend.yml](../.github/workflows/deploy-backend.yml) termina en `sam deploy` y reporta éxito. Pero "el stack se actualizó" no es lo mismo que "la app funciona": el deploy puede salir verde con la API completamente rota.

**Qué hacer**

Agregar un step después de `sam deploy` que abra un WebSocket contra el endpoint recién desplegado, cree una sala, se una, vote y cierre. Si falla, el workflow falla.

**Criterio de aceptación**

- [ ] Corre contra la URL del ambiente que se acaba de desplegar (leída de los outputs del stack, no hardcodeada).
- [ ] Un endpoint roto deja el deploy en rojo.
- [ ] Se limpia lo que crea (la sala de prueba no queda dando vueltas — el TTL ayuda, pero no conviene depender de eso).

### 6.2 — Multi-ambiente para web

**El problema**

El backend tiene tres ambientes reales; `apps/web` tiene tres archivos de environment pero **dos apuntan al mismo lugar** (`environment.ts` y `environment.development.ts` son idénticos: `ws://localhost:3001`), y `environment.aws.ts` apunta directo al endpoint de `prod`. La web solo se despliega desde `master` a GitHub Pages contra `prod`. No hay forma de probar la web contra `qa`.

**Qué hacer**

Extender el modelo de ambientes del backend a la web. Decisión de diseño a tomar y documentar: GitHub Pages sirve un solo sitio por repo, así que hace falta o subdirectorios por ambiente, o mover a S3 + CloudFront, o hacer que la URL del WebSocket sea configurable en runtime en vez de en build time.

Esa última alternativa es la decisión de fondo —configuración en build time vs. runtime— y es la que más consecuencias tiene a largo plazo.

**Criterio de aceptación**

- [ ] Existe una forma de acceder a la web apuntando a `qa` sin buildear localmente.
- [ ] Los tres environments de Angular tienen sentido (hoy dos son duplicados).
- [ ] La decisión y sus alternativas descartadas quedan en el `design.md` del change.
- [ ] README actualizado: sacar la frase *"apps/web no tiene ambientes múltiples todavía"*.

---

## Fase 7 — Release y colaboración

Esta fase tiene el valor más bajo mientras el repo lo mantenga una sola persona, y el más alto en el momento en que entra una segunda. Va última, pero va.

### 7.1 — Versionado y changelog

**El problema**

`git tag v1.5.0` está en la convención de [git-branching-strategy.md](git-branching-strategy.md), pero no hay tags en el repo, ni changelog, ni relación entre lo que está desplegado en `prod` y una versión nombrable. Si `prod` se rompe, no hay respuesta rápida a *"¿qué cambió?"*.

**Qué hacer**

`nx release` ya está parcialmente configurado (arreglado en 3.2). Los commits ya siguen Conventional Commits a mano (`feat:`, `docs:`, `chore:`), o sea que la generación automática de changelog está a un paso.

**Criterio de aceptación**

- [ ] Un comando genera version bump + changelog + tag desde los commits.
- [ ] El changelog queda commiteado en el repo.
- [ ] El deploy a `prod` registra qué versión desplegó (visible en el resumen del workflow, no solo en el SHA).

### 7.2 — Higiene de colaboración

**Criterio de aceptación**

- [ ] `CODEOWNERS` — trivial hoy, pero define quién revisa qué cuando entra alguien más.
- [ ] Plantilla de PR que pida el link al change de OpenSpec correspondiente. Cierra el ciclo entre el proceso de diseño y el de revisión, que hoy están desconectados.
- [ ] `commitlint` en CI para que Conventional Commits sea verificado y no solo una costumbre (prerequisito real de 7.1: si un commit se escapa del formato, el changelog sale mal).

---

## Deuda menor detectada de paso

No justifican una fase propia; se barren cuando se toque el área.

- [ ] `apps/web/src/environments/environment.ts` y `environment.development.ts` son byte por byte idénticos (Fase 6.2).
- [ ] `INSTALL_LOG.md` (23 KB en la raíz) parece un artefacto de instalación inicial. Evaluar si va a `docs/` o se elimina.
