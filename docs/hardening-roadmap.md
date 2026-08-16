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
| 2 | [Tests del backend](#fase-2--tests-del-backend) | ✅ Completa | 1 |
| 3 | [Higiene del workspace](#fase-3--higiene-del-workspace) | ✅ Completa | 1 |
| 4 | [Observabilidad](#fase-4--observabilidad) | ✅ Completa | — |
| 5 | [Seguridad y supply chain](#fase-5--seguridad-y-supply-chain) | ✅ Completa | 1 |
| 6 | [Confianza en el deploy](#fase-6--confianza-en-el-deploy) | ⬜ Pendiente | 1, 4 |
| 7 | [Release y colaboración](#fase-7--release-y-colaboración) | 🟡 7.1 y 7.3 hechas · 7.2 pendiente | 1 |

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

### 2.2 — Test de integración contra DynamoDB Local ✅

> **Hecha** el 2026-08-15, change `add-backend-integration-tests`. Lo que quedó distinto de lo que este documento anticipaba:
>
> - **El plan original de separar el target ("segunda entrada de `@nx/jest/plugin`") no era viable, y se descubrió recién implementando.** El glob que usa el plugin para descubrir configs de Jest está fijo (`jest.config.{cjs,mjs,js,cts,mts,ts}`) — un nombre distinto nunca se descubre, sea cual sea el `include`/`exclude`. Y moverlo a una subcarpeta con el nombre correcto tampoco alcanza: el plugin exige que esa carpeta tenga su propio `package.json`/`project.json`, es decir, ser la raíz de un proyecto Nx distinto. Convertirlo en proyecto hermano (el patrón que sí usa `e2e/`) chocaba con `enforce-module-boundaries`: `realtime-api` es `type:app`, y las apps son hojas — nada puede depender de ellas, ni siquiera un proyecto de tests.
> - **La solución real: `test-integration` declarado a mano en `project.json` con `nx:run-commands`**, invocando `jest --config jest.integration.config.cts` directo — ni la inferencia del plugin ni su executor dedicado (`@nx/jest:jest`, deprecado, se elimina en Nx v24).
> - **DynamoDB Local aísla datos por credenciales**, no solo por región. Sin credenciales AWS explícitas (dummy, como ya usa `dev:db:create-table`), el SDK resolvía las credenciales reales de esta máquina y la tabla creada con credenciales dummy no aparecía — `ResourceNotFoundException` aunque la tabla existiera.
> - **Job de CI nuevo, en paralelo a `verify` y `e2e`**, no adentro de ninguno — reusa `npm run e2e:db:up` de la Fase 1.2. `deploy-backend` depende de él: un bug real en las queries no debería desplegarse solo porque los unitarios mockeados no lo detectan.

~~Agregar una capa fina de integración que corra `lib/room-repository.ts` contra DynamoDB Local — la infra ya existe (`npm run dev:db:up` + `npm run dev:db:create-table`).~~

**Criterio de aceptación**

- [x] Los tests crean y limpian sus propios datos (nada de estado compartido entre tests).
- [x] Corren en CI (misma infra que se armó en 1.2).
- [x] Están separados de los unitarios: `nx test realtime-api` sigue siendo rápido y no necesita Docker.

### 2.3 — Cobertura con umbral ✅

> **Hecha** el 2026-08-15, junto con la 2.2, change `add-backend-integration-tests`. Cobertura real medida al fijar el umbral: Statements 86.38%, Branches 76.2%, Functions 95.52%, Lines 86.12% — redondeada hacia abajo a enteros (86/76/95/86) para el `coverageThreshold`. Verificación activa confirmada: subir el umbral a 100% hace fallar `nx test realtime-api --coverage` con el mensaje real de Jest, no uno decorativo.

~~Activar reporte de cobertura y fijar un umbral mínimo que falle el build si baja.~~

**Criterio de aceptación**

- [x] `nx test realtime-api --coverage` produce reporte.
- [x] Hay un umbral configurado, fijado en el valor ya alcanzado (no un número aspiracional).
- [x] CI falla si la cobertura baja de ese umbral.

**Trampas**

- El workspace mezcla runners (Jest en 3 proyectos, Vitest en `web`). Agregar la cobertura de todos en un solo número es trabajo extra y poco valor — mantener el umbral **por proyecto**.

### 2.4 — Tests del cliente (`room-client-runtime` + `apps/web`) ✅

> **Hecha** el 2026-08-16, change `add-web-client-tests`. Lo que quedó distinto de lo que este documento anticipaba:
>
> - **El fake de `RoomSocketService` no reutiliza `vi.fn()`**, a pesar de que `vitest/globals` está habilitado (`tsconfig.spec.json`). El fake vive en `apps/web/src/app/testing/fake-room-socket-service.ts`, fuera del patrón `*.spec.ts`/`*.test.ts` que `tsconfig.spec.json` incluye — así que el tipo ambiente de `vi` no está disponible ahí. Se optó por métodos y arrays planos (`rejoinIfNeededCalls: string[]`, etc.) en vez de tocar el `include` de `tsconfig.spec.json` para un solo archivo de test-helper.
> - **Umbral final**: Statements 34%, Branches 41%, Functions 25%, Lines 38%. Son números bajos comparados con `realtime-api` (86/76/95/86) porque la mayoría de los componentes de UI de `apps/web` siguen sin test — el umbral fija el piso de hoy, no certifica que la cobertura sea buena.
> - **El número medido en local no se sostuvo en CI**: en local la suite midió 38.64/48/26.35/43.44, pero el runner de GitHub Actions midió 35.5/42.66/26.35/39.69 con el mismo código — una variación real y documentada del proveedor de cobertura `v8` de Vitest entre entornos con distinto paralelismo de workers, no un test roto. El PR falló una vez en CI con el umbral fijado sobre el número local antes de corregirlo. El umbral final se fijó por debajo del número de **CI**, con margen extra, no del local — ver `design.md` del change, Decisión 3.
> - **Hallazgo no anticipado**: saltear los tests de `room.spec.ts` (vía `it.skip`, como prueba de que el umbral realmente rompe la build) subió la cobertura global en vez de bajarla, porque sin `TestBed.configureTestingModule(...).compileComponents()` corriendo, Angular no instrumenta el árbol de componentes hijos (`ParticipantList`, `VotingBoard`, `RevealPanel`) de la misma forma. La prueba de "esto rompe si baja la cobertura" se hizo en cambio con `room-session-store.spec.ts`, que no tiene ese efecto colateral.

**El problema**

Esta fase se llama "Tests del backend" a propósito — el lado cliente nunca estuvo en su alcance. La primera exploración de esta fase (antes de leer el código a fondo) partió de un número bajo de específicos:

| | Archivos fuente | Con test |
|---|---|---|
| `apps/web` (componentes, servicios) | 15 | 3 — incluye `app.spec.ts`, el scaffold genérico de Nx |
| `room-client-runtime` (lógica extraída del cliente en `uncouple-client-logic`) | 4 | 1 |

Y de una hipótesis que **resultó incorrecta al leer el código real**: que `session-store.ts` y `room-socket.service.ts` eran el hueco detrás del bug documentado en [known-issues.md](known-issues.md) ("Link directo a una sala..."). Dos cosas se cayeron al verificar:

- **`session-store.ts` es solo una interfaz TypeScript** (`SessionStore`, `StoredSession`) — no tiene lógica, no hay nada que testear ahí.
- **La lógica real (`RoomClient.rejoinIfNeeded`, en `room-client.ts`) ya tenía 11 tests**, tres de ellos sobre `rejoinIfNeeded` específicamente — incluido uno que confirma el mecanismo exacto detrás del bug (`no reingresa ni se conecta sin sesion guardada`). No es un hueco de cobertura.
- **El bug en sí ya estaba resuelto**, sin que nadie actualizara la documentación — verificado en vivo (stack local completo, navegador real) el 2026-08-15. Ver la entrada corregida en `known-issues.md`.

El hueco real, verificado, es otro:

- `apps/web/src/app/core/room-session-store.ts` (`BrowserSessionStore`, la implementación de `SessionStore` con `sessionStorage` real) — sin test.
- `home.ts` y `room.ts` — tienen lógica real (validaciones, señales computadas, y el flujo de redirect-con-query-param que resuelve el bug) y **cero tests**. Es justo la ausencia de un test ahí lo que dejó pasar el arreglo del bug sin que nada lo asentara — se rompe otra vez tan silenciosamente como se arregló.

**Qué hacer**

Empezar por `home.ts`/`room.ts` — un test de regresión del flujo `/room/<código>` sin sesión → redirect a `/?room=<código>` → formulario precargado, para que ese comportamiento no se pierda una segunda vez sin que nadie se entere. Después, `BrowserSessionStore` (chico, fácil). El resto de `room-client-runtime` ya tiene buena cobertura — no hace falta tocarlo salvo que aparezca un gap concreto.

**Criterio de aceptación**

- [x] `home.ts`/`room.ts` tienen un test que cubre el flujo de reingreso sin sesión (el que resuelve el bug de "Link directo a una sala").
- [x] `BrowserSessionStore` (`apps/web/src/app/core/room-session-store.ts`) tiene test.
- [x] Umbral de cobertura propio para `web` — mismo criterio de trinquete que la 2.3, sin mezclarlo con el de `realtime-api` (runners distintos: Vitest vs Jest). `room-client-runtime` ya tiene cobertura real; si se le pone umbral, se fija en lo ya alcanzado, no en una aspiración.

**Trampas**

- `apps/web` usa Vitest (`@angular/build:unit-test`, `runner: vitest`), `room-client-runtime` usa Jest — dos configuraciones de cobertura separadas, no una.
- Ver [known-issues.md](known-issues.md) — la entrada de "Vitest con Angular falla por la casing de la letra de unidad en Windows" puede reaparecer al escribir tests nuevos en `web` si el entorno tiene la variable `NX_WORKSPACE_ROOT_PATH` mal seteada.
- `npm run dev:api` (usado para probar el flujo a mano) no setea credenciales AWS dummy — en una máquina con perfil de AWS real configurado, el backend local falla con `ResourceNotFoundException` contra DynamoDB Local aunque la tabla exista. Es el mismo aislamiento por credenciales/región que ya documenta [sam-local-dynamodb-local.md](sam-local-dynamodb-local.md) para `sam local invoke` — acá pega igual, y `docs/local-dev-workflow.md` todavía no lo menciona.

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

### 3.2 — `nx.json`: `release.projects` apuntaba a un proyecto inexistente ✅

> **Hecha** el 2026-08-14, change `clean-workspace-config`. Se **eliminó el bloque `release` entero**, no se corrigió el nombre. Corregir `"api"` → `"realtime-api"` habría dejado en pie `"projectsRelationship": "independent"` — versión y tag por proyecto — que contradice cómo se releasea este repo hoy: un tag único para el repo completo (`v1.4.1`). Arreglar solo el nombre habría cambiado el síntoma de "falla con un error claro" a "corre y versiona mal", que es peor. El diseño real del versionado queda para la Fase 7.1, con el modelo completo delante.

~~[nx.json](../nx.json) declara `"release": { "projects": ["api"] }`, pero no existe ningún proyecto llamado `api` — se llama `realtime-api` (`npx nx show projects` lo confirma).~~

**Criterio de aceptación**

- [x] O se corrige a `realtime-api`, o se elimina el bloque `release` hasta que la Fase 7 lo necesite de verdad. Cualquiera de las dos, pero no dejarlo como está.

### 3.3 — Plugin de Docker sin Dockerfile ✅

> **Hecha** el 2026-08-14, change `clean-workspace-config`. Se sacó en sus tres capas: la entrada del plugin en `nx.json`, `@nx/docker` de `package.json`, y `@nx/node` de `package.json` — este último porque `@nx/docker` es su dependencia **dura** (no peer), así que sacar solo `@nx/docker` no lo desinstalaba de verdad. Y `@nx/node` no lo usaba ningún target: `realtime-api:serve` corre con el executor `@nx/js:node`, de un paquete distinto. Si en el futuro se agrega una app Node, el patrón a copiar es el de `realtime-api`, no los generadores de `@nx/node` — reinstalarlo es un `npm i -D` reversible si hiciera falta.

~~`nx.json` registra el plugin `@nx/docker` con `buildTarget`/`runTarget`, y `@nx/docker` está en `devDependencies`, pero **no existe ningún Dockerfile en el repo**. El backend se despliega como Lambdas vía SAM, así que probablemente el plugin sobra.~~

Las dependencias no usadas no son gratis: son superficie de ataque (Fase 5), ruido en el árbol de decisiones, y tiempo de instalación en cada corrida de CI.

**Criterio de aceptación**

- [x] Decidir: o se usa (¿hay un caso? ¿el dev server local containerizado?) o se saca el plugin de `nx.json` y la dependencia de `package.json`.
- [x] Si se saca: confirmar que `npx nx show projects` y los builds siguen funcionando.

---

## Fase 4 — Observabilidad

### El problema

Cero logging estructurado, cero alarmas, cero tracing. Hay tres ambientes reales corriendo en AWS. **Si `prod` se rompe hoy, alguien tiene que avisar para enterarse.** Es el área del ciclo de vida que falta entera.

### 4.1 — Logging estructurado ✅

> **Hecha** el 2026-08-14, change `add-backend-structured-logging`. Lo que quedó distinto de lo que este documento anticipaba:
>
> - **No era "reemplazar `console.log` sueltos".** `default.ts` —el handler que enruta las 10 acciones, donde vive la lógica de dominio— no tenía un solo `console.log`. Su `catch` externo mandaba el error al cliente por WebSocket y ahí terminaba: CloudWatch nunca se enteraba de nada. `connect.ts` y `disconnect.ts` sí tenían uno cada uno, en texto plano.
> - **Powertools, no una función casera.** Es la práctica establecida para Lambda+Node, y comparte familia con `Tracer` (4.3) y `Metrics` (4.2) — se instala solo `Logger` por ahora, mismo criterio que sacar `@nx/node` en la Fase 3.
> - **El logging se centraliza en `default.ts`**, un solo punto de instrumentación para las 10 acciones, en vez de tocar diez archivos.
> - **`handleCreateRoom` pasa a devolver el `roomId`** que genera — es el único mensaje sin `roomId` en el request, porque la sala no existe todavía cuando llega. Sin esto, la creación de una sala quedaría fuera de "reconstruir la sesión".
> - **Hallazgo de paso**: el `catch` del broadcast best-effort en `disconnect.ts` se tragaba cualquier error sin loguear nada. Sigue sin relanzar —es best-effort a propósito— pero deja de ser mudo. Cubierto con un test nuevo (`disconnect.spec.ts`), no forzado en `dev` real para no romper infraestructura compartida a propósito.
> - **Verificado en `dev` real**: se desplegó, se generó actividad con un cliente WebSocket directo, y se forzó una excepción real (un voto con valor `undefined`, que dispara `ValidationException: ExpressionAttributeValues must not be empty` del SDK de DynamoDB). El log de error salió con `roomId`, `action`, `durationMs` y el stack completo. La query de Logs Insights reconstruyó la sala entera en orden. Todo documentado en [aws-observability.md](aws-observability.md).
>
> **Continuación directa, no parte del criterio original**: al verificar esto se encontró que ningún log group tenía retención (`None` = nunca expira) y que 9 quedaban huérfanos en `dev` cada vez que un deploy forzaba el reemplazo de una función — un problema que no tenía nombre en el criterio de 4.1 porque hasta ahora los logs no valían la pena retener. Se resolvió aparte, en el change `add-log-retention` (2026-08-15): retención de 7/7/14 días por ambiente (`dev`/`qa`/`prod`), y el log group pasa a ser un recurso propio del stack con nombre fijo — lo que también evita que un reemplazo futuro vuelva a dejarlo huérfano. En `prod`, el huérfano transicional tenía tráfico real: se le fijó la misma retención en vez de borrarlo de un saque.

**Criterio de aceptación**

- [x] Todos los logs del backend salen como JSON de una línea.
- [x] Cada log de una acción incluye `roomId` y la acción, para poder reconstruir la sesión de una sala.
- [x] Los errores loguean el stack completo y el contexto, no solo el mensaje.
- [x] Una query de CloudWatch Logs Insights documentada en `docs/` que muestre los errores de la última hora, escrita y probada contra `dev`.
- [x] Prueba práctica del resultado: se puede contestar *"¿qué pasó en la sala ABC123 hace 20 minutos?"* sin leer código.

### 4.2 — Alarmas en CloudWatch ✅

> **Hecha** el 2026-08-15, change `add-backend-alarms`. Lo que quedó distinto de lo que este documento anticipaba:
>
> - **"Errores 5xx de API Gateway" no existe para una WebSocket API.** Mismo tipo de limitación que la de X-Ray en la Fase 4.3: la métrica "5xx" es exclusiva de REST/HTTP APIs. Se usó `IntegrationError` (4XX/5XX devueltos por la integración, es decir, por la Lambda) como equivalente funcional, confirmado contra la doc oficial de AWS.
> - **Cuatro alarmas agregadas, no una por función.** Alarmar cada métrica (`Errors`, `Throttles`, `Duration` p99) por cada una de las tres Lambdas daría 9 recursos; se combinaron con metric math (`SUM` para `Errors`/`Throttles`, `MAX` para `Duration` p99) en 3 alarmas — con los logs (4.1) y el tracing (4.3) ya cubriendo el diagnóstico fino, alcanza con saber que alguna de las tres tuvo un problema.
> - **El email de notificación es un `Parameter`, no un `Mappings`.** Inyectado vía `parameter_overrides` en `infra/samconfig.toml`, mismo mecanismo que ya usa `Environment` — no es un valor estructural del diseño, es "quién recibe el aviso al desplegar esta instancia".
> - **Hallazgo de paso, no anticipado**: al forzar errores reales para probar la alarma, se encontró que `connect.ts`/`disconnect.ts` pueden crashear sin dejar un log estructurado de Powertools — a diferencia de `default.ts`, no tienen `try`/`catch` propio. Documentado en [known-issues.md](known-issues.md#connectts-y-disconnectts-pueden-crashear-sin-dejar-un-log-estructurado), sin resolver en este change.
> - **Verificado en `dev` real**: se confirmó la suscripción SNS a mano (paso manual, no automatizable), se invocó `ConnectFunction` directamente cuatro veces con un evento vacío para cruzar el umbral de `dev` (>3 en 5 min), `poker-planning-dev-lambda-errors` pasó a `ALARM`, y el email de notificación llegó. Todo documentado en [aws-observability.md](aws-observability.md).

~~En [infra/template.yaml](../infra/template.yaml), agregar alarmas y una suscripción SNS a un email. Mínimo viable:~~

- ~~Errores de Lambda > N en 5 minutos.~~
- ~~Throttles de Lambda > 0.~~
- ~~Errores 5xx de API Gateway.~~ Corregido: `IntegrationError`, no soportada la métrica "5xx" en WebSocket APIs.
- ~~Duración p99 de Lambda por encima de un umbral.~~

**Criterio de aceptación**

- [x] Las alarmas se crean por ambiente (una alarma de `dev` no puede despertar por un problema de `prod`).
- [x] **Probado que dispara**: forzar un error en `dev` y confirmar que llega la notificación. Una alarma que nunca se vio disparar no existe.
- [x] Umbrales distintos por ambiente, o `dev` genera spam hasta que alguien apaga las notificaciones — que es la forma más común en que muere el monitoreo.

### 4.3 — Tracing distribuido (opcional) ✅

> **Hecha** el 2026-08-15, change `add-backend-tracing`. Lo que quedó distinto de lo que este documento anticipaba:
>
> - **El criterio de aceptación original no era alcanzable tal cual estaba escrito.** *"API Gateway → Lambda → DynamoDB → broadcast"* asume un segmento de API Gateway que X-Ray no puede crear: la documentación oficial de AWS es explícita — *"X-Ray only supports tracing for REST APIs through API Gateway"* — y este backend usa un WebSocket API (`AWS::ApiGatewayV2::Api`, `ProtocolType: WEBSOCKET`), el caso no soportado. El timeline real arranca en Lambda, no en API Gateway. Verificado contra `dev`: en ningún trace generado aparece un segmento con `origin` distinto de `AWS::Lambda`/`AWS::Lambda::Function` como entrada.
> - **Cada invocación de Lambda es un trace independiente**, no uno que una `connect` → mensajes de `default` → `disconnect` de una misma sesión — X-Ray no tiene forma de propagar un trace ID entre invocaciones separadas de un WebSocket API. Para reconstruir una sesión completa, siguen sirviendo los logs de la Fase 4.1.
> - **Powertools Tracer, no `aws-xray-sdk-core` directo** — misma familia que el `Logger` de la Fase 4.1, y `tracer.captureAWSv3Client()` instrumenta un cliente de AWS SDK v3 en una línea.
> - **`tracer.putAnnotation()` llamado directo en el handler no funcionaba** — hallazgo real durante la verificación contra `dev`, no algo previsto en el diseño inicial. Powertools rechaza anotar el segmento *facade* que Lambda crea para toda la invocación (`"You cannot annotate the main segment in a Lambda execution environment"`, con un `console.warn` silencioso). Se resolvió con el patrón de instrumentación manual que el propio paquete documenta: abrir un subsegmento propio al entrar al handler, anotar ahí, cerrarlo al salir.
>
> **Verificado en `dev` real**: se generó una sesión completa (crear sala, unirse, votar, revelar, cerrar) contra el endpoint desplegado. Aparecieron 6 traces —uno por acción procesada por `default`—, todos filtrables por `annotation.roomId` vía `aws xray get-trace-summaries`. El trace de `reveal` mostró el subsegmento `## reveal` con la duración de cada llamada a DynamoDB y a la API Gateway Management API por separado. Todo documentado en [aws-observability.md](aws-observability.md).

~~Activar AWS X-Ray en las Lambdas y el API Gateway (`Tracing: Active` en el template de SAM). Con una sola Lambda el valor es limitado.~~

**Criterio de aceptación**

- [x] ~~Se puede ver el timeline de un mensaje WebSocket: API Gateway → Lambda → DynamoDB → broadcast.~~ Corregido: el timeline va de Lambda → DynamoDB → broadcast — API Gateway no soporta X-Ray para WebSocket APIs (ver nota arriba).
- [x] Identificado dónde se va el tiempo en la acción más lenta.

---

## Fase 5 — Seguridad y supply chain

### El problema

~90 devDependencies, sin Dependabot ni Renovate, sin `npm audit` en CI, sin CodeQL, sin secret scanning. Eso se degrada solo: en 6 meses el salto de versiones es tan grande que actualizar se vuelve un proyecto en sí mismo.

Nota de contexto: la app no tiene autenticación por diseño (salas efímeras sin login), así que el riesgo de authz es acotado — pero el WebSocket público sin rate limiting sí es superficie real.

### 5.1 — Actualización automática de dependencias ✅

> **Hecha** el 2026-08-15, change `add-dependabot-config`. Lo que quedó distinto de lo que este documento anticipaba:
>
> - **Dependabot, no Renovate.** El documento dejaba la puerta abierta a Renovate por agrupar mejor, pero requiere instalar una GitHub App externa (cuenta y permisos propios) o correr un runner self-hosted. Las tres condiciones del criterio de aceptación se logran con la sintaxis nativa de Dependabot (`groups`, `schedule.interval`, `update-types`), sin agregar una dependencia externa al proceso. Queda como opción de escalamiento si el volumen lo justifica más adelante.
> - **`target-branch: develop` explícito, en las tres entradas.** El branch por defecto del repositorio en GitHub es `master` (`gh repo view --json defaultBranchRef` lo confirma), no `develop`. Sin este campo, Dependabot habría abierto los PRs contra `master` — que además está protegido desde la Fase 1.3 con checks pensados para un release ya estabilizado, no para una actualización recién propuesta.
> - **Dos entradas `npm`, no una.** `apps/mobile` tiene su propio `package.json` y `package-lock.json`, aislado del raíz desde la Fase 1.1 porque el executor de Expo corrompe el lockfile si comparte uno con el resto del workspace. Sin una segunda entrada apuntando ahí, sus dependencias habrían quedado fuera de cualquier actualización automática.
> - **Siete grupos por entrada, no un agrupado único.** `angular`, `nx` y `expo-react-native` (restringidos a `minor`/`patch`), más `aws-sdk`, `lint-and-format`, `testing` y un catch-all `build-tooling` para el resto. El catch-all lleva `exclude-patterns` con los patrones de las tres familias especiales — sin eso, un `major` de Angular/Nx/Expo que no matchea las reglas de su propio grupo (restringidas a `minor`/`patch`) caería igual en el catch-all por ser `patterns: ["*"]`, solo que agrupado en vez de individual. Ese mecanismo (grupo evaluado en orden, primer match gana) es el que deja los majors de esas tres familias como PR individual, tal como pide el criterio de aceptación.
> - **Se agregó una tercera entrada, `github-actions`.** No estaba en el criterio de aceptación original, pero es la misma superficie de supply chain que el resto de la Fase 5 y el costo es cuatro líneas en el mismo archivo — un único grupo, sin restricciones, porque las actions no tienen el problema de migración asistida que sí tienen Angular/Nx/Expo.
> - **`open-pull-requests-limit: 10`** en las dos entradas `npm` (el default es 5). Con siete grupos posibles por entrada, el límite por defecto podía dejar actualizaciones calladas en cola sin ningún aviso.

**Qué hacer**

~~`.github/dependabot.yml` (o Renovate, que agrupa mejor). Configurarlo para agrupar por ecosistema — 90 PRs sueltos por semana se terminan ignorando, y un Dependabot ignorado es peor que ninguno.~~

**Criterio de aceptación**

- [x] Los updates llegan agrupados (ej: todo `@nx/*` junto, todo `@angular/*` junto), con cadencia semanal, no diaria.
- [x] El CI de la Fase 1 corre sobre esos PRs — sin eso no sirven de nada.
- [x] Angular, Nx y Expo excluidos del agrupado automático o marcados aparte: sus majors necesitan `nx migrate` / `expo upgrade`, no un bump de `package.json`.

### 5.2 — Auditoría de dependencias en CI ✅

> **Hecha** el 2026-08-15, change `audit-dependencies-in-ci`. Lo que quedó distinto de lo que este documento anticipaba:
>
> - **El umbral que rompe el build es `critical`, no `high` como sugería el borrador.** Verificado con `npm audit --json` contra la raíz el mismo día: 63 vulnerabilidades — 0 `critical`, 48 `high`, 13 `moderate`, 2 `low`. Las 48 `high` son enteramente herramientas de build/CLI (Angular CLI, Nx y sus plugins, Expo CLI, Metro, Vite), ninguna en código de runtime. Con `--audit-level=high` el job nace rojo el primer día y se queda así indefinidamente — la trampa que esta misma sección advertía, solo que con un número puesto encima.
> - **`--production` (`--omit=dev`) no alcanzaba a bajar el ruido, y se probó antes de descartarlo.** Este `package.json` no separa build tooling de dependencias de runtime de forma limpia: `@angular-devkit/build-angular`, `expo`, `react-native` están bajo `"dependencies"`, no `"devDependencies"`. Con `--omit=dev --audit-level=high` seguían quedando 27 `high`. Se acotó por la otra vía que esta misma sección sugería: el `--audit-level`.
> - **El job no usa `nx affected`**, a diferencia de `verify`/`test-integration`/`e2e`: una vulnerabilidad de la cadena de dependencias no es "afectada" por proyecto, vive en el árbol instalado completo. Corre siempre, sobre el `package-lock.json` de la raíz entero.
> - **Gatea `deploy-backend` y `deploy-web`** (se agregó a su `needs:`), mismo patrón que `test-integration` estableció en la Fase 2.2 — no se agregó a los checks obligatorios de branch protection (siguen siendo solo `verify` y `e2e`), decisión de gobernanza que queda fuera de esta fase.
> - **`apps/mobile` queda fuera de alcance**: tiene su propio `package-lock.json`, separado del de la raíz — mismo criterio que la Fase 1.1 ya usó para sacar su build del gate de `nx affected`.
> - `docs/ci-pipeline.md` se actualizó con el job nuevo (tabla, diagrama y las dos secciones de "qué corre según qué cambies") para que el mapa del pipeline no quedara desactualizado. El detalle completo de la decisión de umbral está en el `design.md` del change.

**Criterio de aceptación**

- [x] Un job que corre `npm audit` con un umbral de severidad acotado. Corregido: `--audit-level=critical`, no `--audit-level=high` — `--production` se probó y no alcanzaba a bajar el ruido en este `package.json` (ver el `design.md` del change).
- [x] Definido explícitamente qué severidad rompe el build y cuál solo avisa. Documentado en el `design.md` del change y en `openspec/specs/continuous-integration/spec.md`.

**Trampas**

- `npm audit` sobre devDependencies genera mucho falso positivo (una vulnerabilidad en una herramienta de build no es la misma que una en runtime). Si rompe el build por todo, en dos semanas alguien le pone `|| true` — y ahí se pierde la señal para siempre.

### 5.3 — Análisis estático y secret scanning ✅

> **Hecha** el 2026-08-15, change `add-codeql-scanning`. Lo que quedó distinto de lo que este documento anticipaba:
>
> - **CodeQL cubre las dos apps con un solo lenguaje.** `apps/web` y `apps/realtime-api` son ambos JS/TS, y CodeQL analiza por lenguaje, no por proyecto de Nx — no hizo falta matrix ni un job por app. `.github/workflows/codeql.yml` corre en `pull_request` y `push` a `develop`/`master`, más un cron semanal para detectar hallazgos nuevos sobre código que no cambió.
> - **Sin paso de build.** A diferencia de lenguajes compilados, el extractor de JS/TS de CodeQL parsea el código fuente directamente — no hace falta `npm ci` ni `nx build` antes de analizar.
> - **`infra/env.json` está limpio**: nunca estuvo trackeado (verificado con `git log --all --full-history` sobre el archivo, sin resultados), y la entrada de `.gitignore` lo cubre. `infra/env.json.example` solo tiene placeholders (`DYNAMODB_ENDPOINT` de ejemplo, sin credenciales). La intención — ejemplo trackeado, real ignorado — se cumple de hecho, no solo de nombre. No hubo que rotar nada.
> - **Secret scanning + push protection no se activaron desde código.** Es un toggle de Settings del repositorio en GitHub, no un archivo versionable — quedó fuera del PR a propósito, documentado como acción manual pendiente. El dueño del repo lo activó por separado el mismo día (Settings → Advanced Security), confirmado en `tasks.md` del change.

**Criterio de aceptación**

- [x] CodeQL activo para JavaScript/TypeScript (workflow provisto por GitHub).
- [x] Secret scanning + push protection activados en Settings del repo. Activados el 2026-08-15 por el dueño del repo (fuera de CI, es un toggle de Settings).
- [x] Revisado que [infra/env.json](../infra/env.json) no tenga secretos commiteados y que esté en `.gitignore` (existe `env.json.example`, así que la intención está — confirmado que se cumple).

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

### 7.1 — Versionado y changelog ✅

> **Hecha** el 2026-08-16, change `add-release-versioning`. Lo que quedó distinto de lo que este documento anticipaba:
>
> - **`nx release` no estaba "parcialmente configurado"** — la Fase 3.2 había eliminado el bloque `release` entero de `nx.json`, a propósito, hasta tener este diseño. Arrancó de cero, no de una config a medio hacer.
> - **El tag sigue siendo la única fuente de verdad para leer la versión** (`currentVersionResolver` vía `conventionalCommits: true`, que ya trae implícita la resolución por tag) — pero `room-client-runtime` y `shared-contracts` (los únicos dos `package.json` que existen en todo el workspace) sí reciben la versión nueva escrita como efecto del versionado. Probado en vivo: no hay forma de evitarlo sin trabajo de configuración adicional, y no reabre el problema de branch protection porque ese commit vive en la rama `release/*`, no en `master` directo.
> - **El paso de `nx release version` + `nx release changelog` va al *cortar* la rama de release, no al promoverla a `master`.** Corregido durante la implementación: hacerlo más tarde (como decía el plan original) arrastraría al changelog los commits sin formato de la estabilización en QA — todo lo contrario de lo que se buscaba. En el momento de cortar la rama, `release/x.y.z` y `develop` apuntan al mismo commit, así que el rango queda limpio de forma natural.
> - **El tag después del merge a `master` sigue siendo manual y simple** (`git tag vX.Y.Z`) — no se usa `nx release` de nuevo ahí, porque la versión y el changelog ya se resolvieron al cortar la rama; volver a correrlo recomputaría desde cero.
> - **`commitlint` verifica el título del PR, no los commits de la rama** — el repo usa squash merge, así que el mensaje que aterriza en `develop`/`master` es el título del PR, no ninguno de los commits intermedios (esos se descartan). Implementado con `amannn/action-semantic-pull-request`, los 11 tipos estándar de Conventional Commits, scope opcional.
> - **La versión desplegada se agregó en 4 lugares, no 2**: además de los workflows manuales (`deploy-backend.yml`, `deploy-web.yml`), el deploy automático real vive en los jobs `deploy-backend`/`deploy-web` de `ci.yml` — ahí también se agregó el resumen.

**Criterio de aceptación**

- [x] Un comando genera version bump + changelog + tag desde los commits. (`npx nx release --skip-publish --git-tag=false`, corrido al cortar la rama de release; el tag final queda manual, ver nota arriba.)
- [x] El changelog queda commiteado en el repo. (`CHANGELOG.md`, generado y comiteado junto con el bump de versión.)
- [x] El deploy a `prod` registra qué versión desplegó (visible en el resumen del workflow, no solo en el SHA).

### 7.2 — Higiene de colaboración 🟡

> **Explorada el 2026-08-16, deliberadamente pendiente.** El ítem de `commitlint` se resolvió como parte de la Fase 7.1 (job `pr-title`) — era un prerequisito técnico real de esa fase, no de esta. Lo que queda (`CODEOWNERS`, plantilla de PR) son ambos diseño para un segundo colaborador que todavía no existe, sin ningún efecto en cómo se trabaja hoy — mismo criterio que ya dejó "0 aprobaciones requeridas" como provisorio en la Fase 1.3. Se deja explícitamente sin hacer hasta que entre esa segunda persona, en vez de cerrarla con archivos placeholder de bajo costo pero cero valor actual.
>
> **Hallazgo a tener en cuenta cuando se implemente**: casi ningún PR de este repo se crea tipeando en la UI de GitHub — se crean con `gh pr create --body "..."`, con el body completo explícito. Una plantilla en `.github/PULL_REQUEST_TEMPLATE.md` solo se auto-completa cuando alguien abre "New Pull Request" en el navegador; `gh pr create --body` la ignora por completo. Si el flujo real sigue siendo "el agente escribe el body a mano", agregar la plantilla no alcanza — hay que buscar además la forma de indicarle al agente que la siga (por ejemplo, referenciarla desde `CLAUDE.md`, o que el propio flujo de PR la lea antes de armar el body), o quedará un archivo que nadie consulta en el camino real.

**Criterio de aceptación**

- [x] `commitlint` — resuelto en la Fase 7.1 (job `pr-title`, lintea el título del PR).
- [ ] `CODEOWNERS` — trivial hoy, pero define quién revisa qué cuando entra alguien más.
- [ ] Plantilla de PR que pida el link al change de OpenSpec correspondiente. Cierra el ciclo entre el proceso de diseño y el de revisión, que hoy están desconectados.

### 7.3 — Specs de OpenSpec con `Purpose` sin completar ✅

> **Hecha** el 2026-08-16. Se escribió un `## Purpose` real (1-2 oraciones, en español, basado en los requirements existentes de cada spec) en las 9 capabilities listadas abajo, sin tocar sus requirements. `openspec validate --specs --strict --json` confirma `valid: true` en las 9, sin ningún warning de "Purpose section is too brief" — quedan únicamente los INFO de "Requirement text is very long" en `backend-deployment`, `estimation-session` y `room-management`, que no son parte de este ítem.

**El problema**

`openspec validate --specs --strict` (comando manual, ningún job de CI lo corre hoy) marca 9 de las 16 capabilities en rojo — todas por la misma razón: `## Purpose` quedó en el placeholder que deja `/opsx:archive` (`TBD` a secas, o `TBD - created by archiving change X. Update Purpose after archive.`) sin que nadie lo reemplazara por una descripción real. Afecta a `backend-deployment`, `estimation-session`, `mobile-app`, `mobile-preview-builds`, `participant-identity`, `room-client-runtime`, `room-management`, `session-summary` y `web-static-deployment`. No es un problema funcional — los requirements de esas specs son válidos y están al día — es puramente la sección `Purpose` sin escribir.

**Qué hacer**

Escribir un párrafo real de `Purpose` en cada una de las 9 (una o dos frases: qué cubre la capability y por qué existe como capability separada). Trabajo mecánico, sin decisiones de diseño.

**Criterio de aceptación**

- [x] Las 9 capabilities listadas tienen un `## Purpose` real, no un placeholder.
- [x] `openspec validate --specs --strict` pasa sin warnings de "Purpose section is too brief" en ninguna spec.

---

## Deuda menor detectada de paso

No justifican una fase propia; se barren cuando se toque el área.

- [ ] `apps/web/src/environments/environment.ts` y `environment.development.ts` son byte por byte idénticos (Fase 6.2).
- [ ] `INSTALL_LOG.md` (23 KB en la raíz) parece un artefacto de instalación inicial. Evaluar si va a `docs/` o se elimina.
