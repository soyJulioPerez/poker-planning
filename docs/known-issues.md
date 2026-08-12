# Problemas conocidos

Archivo único de problemas conocidos del proyecto: infraestructura, tooling, tests y bugs de producto.

> **Nota histórica**: hasta el 2026-08-10 existía además un `openspec/known-issues.md` con los bugs de producto detectados al verificar changes. Los dos archivos se fusionaron acá. Los changes archivados anteriores a esa fecha referencian `openspec/known-issues.md`; esas referencias se dejaron intactas a propósito —son un registro histórico— y apuntan al contenido que ahora vive en este archivo.

## `node-version: 20` deprecado en los workflows de GitHub Actions

**Síntoma**: las corridas de `deploy-backend.yml`, `build-mobile.yml` y `deploy-web.yml` muestran esta anotación:
```
Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on
Node.js 24: actions/checkout@v4, actions/setup-node@v4, aws-actions/configure-aws-credentials@v4,
aws-actions/setup-sam@v2.
```

**Causa**: los 3 workflows fijan `node-version: 20` en el step `actions/setup-node@v4` (usado para instalar dependencias y correr `sam build`/`eas build`, no para las actions de GitHub en sí — esas ya corren forzadas en Node 24 por decisión de GitHub, de ahí la anotación).

**Impacto**: ninguno todavía — es una advertencia, no una falla; las corridas verificadas en `openspec/changes/add-multi-environment-deployment` (runs [31134640527](https://github.com/soyJulioPerez/poker-planning/actions/runs/31134640527), [31135550135](https://github.com/soyJulioPerez/poker-planning/actions/runs/31135550135)) terminaron exitosas igual. GitHub eventualmente puede dejar de soportar runners con Node 20 por completo.

**Recomendación**: subir `node-version: 20` → `24` (o `lts/*`) en los 3 workflows (`deploy-backend.yml`, `build-mobile.yml`, `deploy-web.yml`), en línea con el runtime que ya usan las Lambdas (`nodejs24.x` en `infra/template.yaml`).

**Ojo — `node-version: 24` NO hace desaparecer la anotación.** Son dos cosas distintas:

| Qué | Se controla con | Efecto en la anotación |
|---|---|---|
| El Node que corre `npm ci`, `nx`, `sam build` | `node-version:` en `setup-node` | ninguno |
| El Node que corre **las actions mismas** | la **versión mayor** de cada action | es lo que la dispara |

Verificado en la primera corrida de `ci.yml`, que ya usaba `node-version: 24` y **igual** anotó:

```
Node.js 20 is deprecated. The following actions target Node.js 20 but are being
forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4
```

`actions/checkout@v5` y `actions/setup-node@v5` son los primeros majors que corren en Node 24 (así lo dicen sus release notes). `ci.yml` ya está en v5.

**Pendiente**: `deploy-backend.yml`, `deploy-web.yml` y `build-mobile.yml` siguen con las actions en `@v4` y `node-version: 20`. Migrarlos quedó como Non-Goal del change `add-ci-pipeline` para no mezclar. El ruido bajó mucho —esos tres ahora solo corren por `workflow_dispatch` o para builds de mobile— pero la deuda sigue. Nota al pasar: al 2026-08-11 esas actions van por **v7**, así que el salto pendiente es de más de un major.

## Un release a `master` puede quedar verde sin desplegar ✅

**Detectado**: 2026-08-11, promoviendo `v1.4.0`. **Resuelto** el mismo día.

**Síntoma**: el push a `master` corre `ci.yml`, `verify` y `e2e` pasan, los jobs `deploy-backend` y `deploy-web` quedan **`skipped`**, y producción se queda en la versión anterior. La corrida figura en verde y nada indica que el deploy no ocurrió.

**Causa**: `nrwl/nx-set-shas` recibe `main-branch-name: develop`, así que para `master` calcula la base como el merge-base contra `develop`. Si el sync de vuelta a `develop` se hace **antes** de promover a `master` —el orden inverso al que documenta [git-branching-strategy.md](git-branching-strategy.md)— las dos ramas apuntan al mismo commit y el merge-base es el propio HEAD:

```
NX_BASE  32aee6c
NX_HEAD  32aee6c    → diff vacío → nada afectado → deploys salteados
```

**Solución aplicada**: en push a `master`, `ci.yml` usa `github.event.before` como `NX_BASE`. Como `master` solo avanza por fast-forward desde una rama de release, `before..after` es exactamente el contenido nuevo, sin depender de dónde esté `develop`.

**Lo que se pierde**: la propiedad de "último commit verificado con éxito" que da la action. Si un push a `master` falla y el siguiente lo corrige, el contenido del primero no se reevalúa. Es aceptable —`master` se mueve pocas veces y de forma deliberada— y el camino manual (`deploy-backend.yml` / `deploy-web.yml` por `workflow_dispatch`) cubre el hueco.

**Cómo detectarlo si vuelve a pasar**: en el log del job `verify`, comparar `NX_BASE` y `NX_HEAD`. Si son iguales, el diff está vacío y ningún deploy va a correr.

## Los tabs no comunican cuál está activo fuera del CSS

**Detectado**: 2026-08-10, verificando el change `fix-room-ui-accessibility`.

**Síntoma**: en dos lugares hay tabs cuyo estado activo existe únicamente como clase CSS, invisible para un lector de pantalla y para cualquier selector por rol y estado:

- [apps/web/src/app/pages/home/home.html:5,8](../apps/web/src/app/pages/home/home.html) — `home__tab--active` en "Unirse a sala" / "Crear sala"
- [apps/web/src/app/ui/help-modal/help-modal.html:22,29,36](../apps/web/src/app/ui/help-modal/help-modal.html) — `help-modal__tab--active` en los tres tabs de la guía

**Por qué no se resolvió junto con el resto de la deuda de ARIA**: los otros dos conjuntos de opciones —las cartas del mazo y la grilla de íconos— se arreglaron con `aria-pressed`, que es correcto para un grupo plano de botones toggle. Los tabs son otra cosa: su patrón accesible es `role="tablist"` / `role="tab"` con `aria-selected`, y arrastra manejo de foco compuesto (una sola parada de `Tab` para todo el grupo) y navegación con flechas.

Parcharlos con `aria-pressed` comunicaría el estado pero dejaría la navegación incorrecta, así que sería una mejora a medias que después cuesta más deshacer.

**Recomendación**: un change propio que implemente el patrón de tabs completo en los dos lugares. No bloquea nada: ambos conjuntos son alcanzables y activables con teclado hoy, solo que sin la semántica ni la navegación de un tablist.

## DynamoDB Local: los scripts usan `localhost` y se cuelgan en Windows

**Detectado**: 2026-08-10, levantando el entorno local para verificar un change.

**Síntoma**: `npm run dev:db:create-table` y cualquier operación del backend contra DynamoDB Local quedan colgadas hasta el timeout:

```
aws: [ERROR]: Read timeout on endpoint URL: "http://localhost:8000/"
```

En la app, el síntoma es indirecto y desconcertante: crear una sala falla con *"No se pudo conectar. Intentá de nuevo."* después de 10 segundos, **sin ningún error en el log del backend**. El WebSocket conecta bien; lo que se cuelga es la consulta a DynamoDB.

**Causa**: `localhost` resuelve a IPv6 (`::1`) antes que a IPv4 en Windows. El contenedor publica en ambos (`0.0.0.0:8000` y `[::]:8000`), pero el camino IPv6 no responde. Se confirma con `curl`, que sí funciona porque resuelve distinto:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/   # 400 en 60ms — el servicio está sano
aws dynamodb list-tables --endpoint-url http://localhost:8000     # timeout
aws dynamodb list-tables --endpoint-url http://127.0.0.1:8000     # responde
```

**Afecta** a los scripts de `package.json` que fijan `localhost:8000`:

- `dev:db:create-table`
- `dev:api` (`DYNAMODB_ENDPOINT=http://localhost:8000`)
- `e2e:db:up`, que llama a `dev:db:create-table`

**Solución**: reemplazar `localhost` por `127.0.0.1` en esos scripts. Además, el AWS CLI necesita credenciales aunque sean falsas:

```bash
AWS_ACCESS_KEY_ID=dummy AWS_SECRET_ACCESS_KEY=dummy AWS_EC2_METADATA_DISABLED=true \
  aws dynamodb create-table ... --endpoint-url http://127.0.0.1:8000
```

**Resuelto** el 2026-08-11, change `add-e2e-to-ci`. Los tres scripts usan `127.0.0.1` y `dev:db:create-table` lleva las credenciales dummy. Se agregó además [tools/scripts/wait-for-dynamodb.mjs](../tools/scripts/wait-for-dynamodb.mjs), que `e2e:db:up` invoca antes de crear la tabla: `docker start` vuelve en cuanto el contenedor arranca, no cuando el proceso Java de adentro atiende, y el `create-table` podía correr contra un puerto todavía mudo.

**El reflejo del mismo problema, al revés**: el `http-server` que usa `nx run web:serve-static` escucha **solo** en `[::1]:4200`. Ahí hay que usar `localhost` y no `127.0.0.1`. O sea que en este repo conviven las dos direcciones y ninguna sirve para todo — DynamoDB Local necesita IPv4 explícito, `serve-static` necesita que se resuelva IPv6.

## Playwright: los binarios del navegador no vienen con `npm ci`

**Detectado**: 2026-08-10.

**Síntoma**: los 13 tests e2e fallan de golpe con:

```
Error: browserType.launch: Executable doesn't exist at
C:\Users\<user>\AppData\Local\ms-playwright\chromium_headless_shell-1234\...
```

**Causa**: `@playwright/test` instala la librería, no los navegadores. Hay que bajarlos aparte, y no está documentado en el flujo de desarrollo local.

**Solución**: `npx playwright install chromium` (~115 MB).

**Resuelto en CI** el 2026-08-11, change `add-e2e-to-ci`: el job de e2e de `ci.yml` corre `npx playwright install --with-deps chromium` antes de la suite.

**Sigue aplicando en local**: `npm ci` no baja los navegadores en tu máquina tampoco. La primera vez que corras la suite hace falta `npx playwright install chromium`, como dice [local-dev-workflow.md](local-dev-workflow.md). Un pipeline verde no dice nada sobre esto.

## Vitest con Angular falla por la casing de la letra de unidad en Windows

**Detectado**: 2026-08-10.

> Esta entrada **reemplaza** un diagnóstico anterior del mismo síntoma, que atribuía el fallo a una incompatibilidad de versiones entre Angular `21.2.9` y `@analogjs/vitest-angular@2.2.0`. Esa hipótesis quedó descartada: no hay ninguna incompatibilidad. La causa es ambiental y se describe abajo.

**Síntoma**: cualquier spec que use `TestBed` falla, con un error distinto según la variante de Vitest:

| Variante | Error |
|---|---|
| `vitest-analog` (`nx vite:test web`) | `Error: Need to call TestBed.initTestEnvironment() first` y después `TypeError: Cannot read properties of null (reading 'ngModule')` |
| `vitest-angular` (`@angular/build:unit-test`) | `Error: Vitest failed to find the runner`, en `angular:test-bed-init` |

Falla incluso con el `app.spec.ts` que genera el scaffold de Nx sin modificar. El build (`nx build web`) y el dev server (`nx serve web`) funcionan con normalidad.

**Causa raíz**: el proceso padre (IDE / extensión de Nx / agente) exporta `NX_WORKSPACE_ROOT_PATH` con la letra de unidad en **minúscula** (`c:\claude-code\poker-planning`), aunque la ruta real en disco es `C:\claude-code\poker-planning`. Nx la respeta sin normalizar, porque es una variable de override explícita:

```js
// node_modules/nx/dist/src/utils/workspace-root.js
exports.workspaceRoot = workspaceRootInner(process.cwd(), process.cwd());

function workspaceRootInner(dir, candidateRoot) {
    if (process.env.NX_WORKSPACE_ROOT_PATH)
        return process.env.NX_WORKSPACE_ROOT_PATH;   // corta acá, sin normalizar
    ...
```

Ese root viaja por todo el pipeline hasta Vitest. Node cachea los módulos ESM **por string de URL**, así que `file:///c:/…/vitest` y `file:///C:/…/vitest` son dos entradas distintas: el paquete se carga dos veces y la segunda copia no tiene worker state.

Eso rompe el patrón que usan **las dos** integraciones de Angular con Vitest — guarda en `globalThis` + `TestBed` local al módulo:

```js
const ANGULAR_TESTBED_SETUP = Symbol.for('testbed-setup');              // Analog
const ANGULAR_TESTBED_SETUP = Symbol.for('@angular/cli/testbed-setup'); // Angular oficial

if (!globalThis[ANGULAR_TESTBED_SETUP]) {   // la guarda es global: compartida
  globalThis[ANGULAR_TESTBED_SETUP] = true;
  getTestBed().initTestEnvironment(...);    // el TestBed es del módulo: NO compartido
}
```

La primera copia inicializa y marca la guarda; la segunda ve la guarda puesta, no inicializa, y expone un `TestBed` virgen. De ahí el mensaje engañoso: dice que falta llamar a `initTestEnvironment()` cuando en realidad ya se llamó, sobre la otra instancia.

Es [angular/angular-cli#33559](https://github.com/angular/angular-cli/issues/33559), abierto al 2026-08-10.

**Cómo confirmarlo en 10 segundos**:

```bash
node -e "console.log(JSON.stringify(process.env.NX_WORKSPACE_ROOT_PATH))"
node -e "const {workspaceRoot}=require('nx/src/utils/workspace-root');console.log(JSON.stringify(workspaceRoot))"
```

Si alguno devuelve la unidad en minúscula (`c:\...`) y en disco es mayúscula, es esto.

**Verificado**: sacando la variable del entorno, sin tocar una sola línea del repo, las dos variantes pasaban de fallar a correr:

```powershell
$env:NX_WORKSPACE_ROOT_PATH = $null
npx nx vite:test web     # el target se llamaba así cuando se hizo este diagnóstico
#  RUN  v4.1.10 C:/claude-code/poker-planning/apps/web
#      ✓ should create the app 76ms
#       Tests  1 failed | 1 passed (2)
```

> El comando de arriba queda como registro del diagnóstico. Después de este hallazgo `web` migró a `vitest-angular` y el target pasa a llamarse `test`: hoy el equivalente es `npx nx test web`.

El test que quedaba rojo era un problema real del spec (`querySelector('h1')` devolvía `null` porque el router todavía no había navegado), no del runner — se corrigió al migrar.

**Lo que se descartó como causa**:
- *Incompatibilidad de versiones Angular 21 / Analog* — era la hipótesis anterior. Falsa: con la casing corregida, Analog `2.2.0` funciona sobre Angular `21.2.9`.
- *Configuración mal hecha* — `apps/web/src/test-setup.ts` es idéntico, línea por línea, a la plantilla que genera Nx 23 para Angular 21 (`@nx/vitest/dist/src/generators/configuration/configuration.js:76-83`).
- *Que fuera propio de Analog* — el builder oficial de Angular (`@angular/build:unit-test`, `runner: vitest`) falla igual, por el mismo mecanismo.
- *Que el workaround del issue alcance* — entrar con `cd /d C:\...` **no sirve** mientras la variable esté puesta: corta antes de mirar el `cwd`. Se verificó lanzando el proceso con `cwd` en mayúscula y obteniendo el root en minúscula igual.

**Dónde vive la variable**: no está en el entorno de usuario ni de máquina (`[Environment]::GetEnvironmentVariable('NX_WORKSPACE_ROOT_PATH','User'|'Machine')` devuelven vacío). La inyecta el proceso padre y la heredan todas las shells hijas — por eso aparece tanto en PowerShell como en Git Bash.

**Impacto**: solo Windows y solo desarrollo local. **CI no está afectado**: los runners son `ubuntu-latest`, donde no hay letras de unidad y la variable no se setea. Un pipeline verde no dice nada sobre este problema, y viceversa.

También explica por qué el síntoma aparece en cualquier proyecto Angular abierto desde el mismo entorno: no depende del repo.

**Mitigaciones aplicadas** (2026-08-10):

1. **[.vscode/settings.json](../.vscode/settings.json)** anula la variable en las terminales integradas:
   ```json
   { "terminal.integrated.env.windows": { "NX_WORKSPACE_ROOT_PATH": null } }
   ```
   Se versiona, no afecta a Linux/macOS por el sufijo `.windows`, y deja que Nx calcule el root solo — que es lo que hace bien.
2. **[tools/scripts/check-workspace-root.mjs](../tools/scripts/check-workspace-root.mjs)** compara la variable contra `fs.realpathSync.native()` y, si no coinciden, falla con las dos rutas y cómo corregirlo. Está enganchado como `dependsOn` del target `test` de `web`, con `cache: false` para que corra siempre.

Con eso, el modo de falla dejó de ser un error críptico de `TestBed` y pasó a ser un mensaje que nombra la causa.

**Lo que todavía requiere acción manual**: si abrís el proyecto desde una terminal externa al IDE (o desde otro editor), la variable puede seguir viniendo mal. La solución de fondo es **abrir el proyecto desde la ruta canónica** (`C:\claude-code\poker-planning`, con la `C` mayúscula). Eso no se puede versionar.

**Lo que no funciona** (para no volver a intentarlo): un `.env` en la raíz, una opción en `nx.json`, o `env` en el target de `project.json`. Los tres corren **después** de que `workspaceRoot` quedó fijado — el valor se evalúa al cargar el módulo, cuando arranca el CLI de Nx.

## Tests e2e inestables: el nombre se escribía en el formulario equivocado ✅

**RESUELTO** el 2026-08-11, change `add-e2e-to-ci`. Esta entrada y la de *"participante desconectado"* más abajo eran **el mismo problema**, como se sospechaba: misma firma, misma causa.

**La causa**: la home arranca en modo `join` y **los dos formularios tienen un campo "Tu nombre"** ([home.html:27 y :66](../apps/web/src/app/pages/home/home.html)). Angular 21 corre zoneless, así que el click en el tab "Crear sala" solo **agenda** la detección de cambios: durante un instante el DOM sigue mostrando el formulario de join.

```
1. click tab "Crear sala"  → setMode('create') → CD agendada, DOM sin cambiar
2. fill "Tu nombre"        → escribe en el input del formulario de JOIN
3. corre la CD             → el @if destruye ese input y crea el de create, VACÍO
4. click submit            → createRoom() → nombre vacío → return silencioso
```

Ese `if (!this.moderatorName.trim()) return;` de [home.ts:131](../apps/web/src/app/pages/home/home.ts) no loguea nada: sin error, sin WebSocket, sin navegación. El test moría 10s después en `waitForRoomUrl`, apuntando a un paso que no tenía la culpa.

**El arreglo**: acotar el locator al formulario de creación en `e2e/pages/home.page.ts`, para que el auto-wait de Playwright espere al formulario correcto en vez de escribir en el que está de paso. Los dos tests volvieron a la suite.

**Por qué costó tanto encontrarlo**: en una máquina de desarrollo la carrera se gana casi siempre. Apareció recién al meter la suite en CI, donde el runner es más lento y fallaban 8 a 12 tests por corrida — el gate quedaba verde solo por `retries: 2`. Lo que lo destrabó fue instrumentar: logs del backend, eventos del navegador y `trace: retain-on-failure`. Con eso quedó a la vista que el navegador **nunca creaba el WebSocket**, lo que descartó de un saque el backend, DynamoDB y la red.

> Lo de abajo se conserva como registro de la investigación original.

**Síntoma** *(histórico)*: el test `reconexión automática restaura el voto sin necesidad de re-votar` (`e2e/room-moderation.spec.ts`) falla de forma intermitente con `TimeoutError: page.waitForURL: Timeout 10000ms exceeded`, esperando la navegación a `/room/<código>` justo después de que el **moderador** crea la sala — es decir, falla en el paso más básico del test, antes incluso de llegar a la lógica de reconexión en sí.

**Lo que se descartó como causa** (confirmado durante `openspec/changes/add-e2e-room-moderation-coverage`):
- No es contención de otros tests corriendo en paralelo: falla incluso con `nx e2e e2e -- -g "reconexión"` (`--workers=1`, un solo test, sin ningún otro compitiendo por recursos).
- No es una tabla de DynamoDB Local faltante/corrupta: se confirmó la tabla presente y se recreó desde cero en varias corridas de diagnóstico.
- No es un bug de lógica del test: el mismo código, estructuralmente casi idéntico a otros tests del mismo archivo que sí pasan de forma consistente (ej. `un participante no-moderador no ve controles de moderación`), fallaba y pasaba de forma alternada según el estado acumulado del proceso `realtime-api`/DynamoDB Local en el momento de la corrida.
- Corriendo con `--trace=on` (que ralentiza/serializa la ejecución) el test pasaba consistentemente, sugiriendo una condición de carrera sensible a timing, pero no se logró aislar la causa raíz exacta antes de pausar la investigación automatizada.

**Estado**: el test se dejó marcado con `test.fixme(...)` en vez de `test.skip(...)` — comunica que hay un problema real pendiente de resolver, no una decisión deliberada de no cubrir este caso. El resto de la suite (12/13 tests de `room-moderation.spec.ts` + `estimation-rules.spec.ts` + `estimation-flow.spec.ts`) pasa de forma estable.

**Pasos para reproducir y diagnosticar manualmente** (pendiente, no completado en esta sesión):

1. Levantar el entorno local completo siguiendo `docs/local-dev-workflow.md` (DynamoDB Local + `npm run dev:api` + `npm start`), confirmando que las 3 terminales muestran arranque limpio sin errores.
2. Abrir dos pestañas del navegador en `http://localhost:4200`.
3. Pestaña 1: crear una sala con nombre "Moderador E2E" (mazo Fibonacci, cualquier configuración). Confirmar que navega a `/room/<código>` sin demora perceptible.
4. Pestaña 2: unirse a esa sala con el código, nombre "Participante E2E".
5. Definir una historia desde la pestaña del moderador, votar "5" en ambas pestañas, confirmar "2 de 2 votaron".
6. **Cerrar la pestaña 2 por completo** (no solo navegar afuera — cerrar la pestaña/ventana, simulando pérdida de conexión real).
7. Abrir una **pestaña nueva** (no reutilizar la cerrada) en `http://localhost:4200`, unirse a la misma sala con el mismo nombre "Participante E2E".
8. Verificar en la pestaña del moderador que el conteo sigue mostrando "2 de 2 votaron" sin que el participante reconectado haya vuelto a votar.
9. Repetir los pasos 1-8 varias veces seguidas (5-10 veces), cronometrando cuánto tarda el paso 3 (crear sala → navegar) en cada repetición. Si en alguna repetición ese paso tarda notablemente más que en las demás (o nunca navega), es la misma condición que afecta al test — anotar en qué repetición ocurrió y si coincide con algún patrón (ej. después de cierta cantidad de salas creadas en la sesión).

**Qué buscar si el paso 9 reproduce el problema**: revisar la consola del navegador (F12) en el momento del cuelgue en busca de errores de WebSocket, y el log de la terminal de `dev:api` en busca de excepciones no capturadas o de un `ResourceNotFoundException`/timeout de DynamoDB — este mismo diagnóstico ya identificó que un `docker restart dynamodb-local` sin recrear la tabla causa exactamente este síntoma (ver comando `npm run dev:db:create-table` en `docs/local-dev-workflow.md`), así que vale la pena descartar eso primero si el contenedor fue reiniciado en algún momento de la sesión.

**Si el paso 9 NO reproduce nada anómalo tras varias repeticiones**: el problema podría ser específico del entorno de la máquina donde se corrieron los tests originalmente (recursos limitados, muchos procesos Node acumulados de sesiones previas — se observaron varios procesos zombie reteniendo los puertos 3001/9229 durante el diagnóstico), no de la lógica de la aplicación. En ese caso, se puede intentar quitar `test.fixme` y volver a correr la suite completa para ver si el problema persiste en un entorno más limpio.

> **Ver también** el problema "Test e2e inestable: participante desconectado" más abajo. Ambos fallan en el mismo punto exacto (`waitForRoomUrl` justo después de `createRoom`), en el mismo archivo de tests. Es probable que sean el mismo problema subyacente manifestándose en dos tests distintos — vale la pena investigarlos juntos, no por separado.

## Link directo a una sala en una pestaña nueva nunca conecta

**Detectado**: 2026-07-06, verificando el change `deploy-web-github-pages`.

**Síntoma**: pegar la URL de una sala (ej. `/room/U9DG8K`) en una pestaña nueva —o en un navegador/sesión sin estado previo de esa sala— queda colgado en "Conectando a la sala..." para siempre. Recargar una pestaña *existente* que ya se unió a la sala funciona bien.

**Causa raíz**: `RoomSocketService.rejoinIfNeeded` (`apps/web/src/app/core/room-socket.service.ts`) solo reconecta si hay una sesión coincidente en `sessionStorage`:

```ts
rejoinIfNeeded(roomId: string): void {
  if (this.room()) return;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return; // no-op: nunca conecta, nunca muestra el formulario de ingreso
  ...
}
```

`sessionStorage` es por pestaña y nunca se llena hasta que el usuario efectivamente envía un nombre desde el flujo de ingreso de la home. Una pestaña recién abierta (alguien que hace clic en un link compartido) no tiene sesión, así que `rejoinIfNeeded` no hace nada en silencio — ni intenta conectar, ni ofrece una UI alternativa para pedir el nombre.

**No está relacionado con**: el deploy a GitHub Pages ni el fallback SPA de `404.html` — ambos funcionan correctamente (verificado con `curl`, comparando `etag`/contenido contra `index.html`, y confirmando el `base href`). Es comportamiento preexistente de la app, reproducible también en desarrollo local.

**Recomendación** (futuro change): cuando `room()` es null y no hay sesión válida para ese `roomId`, mostrar un formulario de "unirse a esta sala" (input de nombre) en vez de dejar al usuario en el estado de carga indefinidamente.

## Test e2e inestable: participante desconectado

**Detectado**: 2026-08-01, verificando el change `uncouple-client-logic`.

**Síntoma**: `e2e/room-moderation.spec.ts:158` (`participante desconectado se marca como desconectado sin salir de la lista`) falla intermitentemente — unas 2 de cada 3 corridas aisladas con `--workers=1` — casi siempre en `waitForRoomUrl` justo después de `moderatorHome.createRoom(...)`, con timeout de 10s esperando la navegación a `/room/...`. En al menos una corrida falló más adelante, en la aserción del estado "desconectado".

**Confirmado que no lo causó `uncouple-client-logic`**: se hizo `git stash` de todos los cambios de ese refactor (volviendo al `RoomSocketService` original basado en `signal()`/`sessionStorage` directo) y se corrió el mismo test 5 veces seguidas contra el código original — **falló las 5 veces**, en el mismo punto exacto. El resto de la suite (11/11 tests restantes) pasa consistentemente en ambas versiones del código.

**RESUELTO** el 2026-08-11, change `add-e2e-to-ci`. La recomendación de investigarlo junto con *"reconexión automática"* estaba bien encaminada: **era la misma causa**. Ver la entrada de arriba para el mecanismo completo.

La hipótesis que figuraba acá —contención de recursos por el segundo `browser.newContext()`— era **incorrecta**. El segundo contexto no tenía nada que ver: el fallo estaba en el primero, escribiendo el nombre en el formulario equivocado antes de que Angular terminara de cambiar de tab.

## Mobile (Expo): el ícono y el splash no cargan, error ENOENT en `assets/images`

**Detectado**: 2026-08-02, probando `apps/mobile` en un dispositivo Android real (change `add-mobile-app`).

**Síntoma**: al correr `npx expo start` desde `apps/mobile` (el directorio correcto) y abrir la app en Expo Go, la terminal muestra repetidamente:

```
Error: ENOENT: no such file or directory, scandir 'C:\claude-code\poker-planning\assets\images'
    at Object.readdir (node:internal/fs/promises:955:18)
    at getAbsoluteAssetRecord (...\node_modules\metro\src\Assets.js:114:17)
```

El path que busca es `<raíz-del-repo>/assets/images`, **no** `apps/mobile/assets/images`, que es donde realmente están los archivos referenciados por `app.json` (`icon.png`, `adaptive-icon.png`, `favicon.png`, `splash-icon.png`). El bundle igual compila y la app funciona —conexión WebSocket, creación de sala y el flujo completo verificados en dispositivo real— solo faltan el ícono y el splash screen.

**Hipótesis sin confirmar**: algo en `withNxMetro` (`apps/mobile/metro.config.js`), que reconfigura Metro para resolver librerías del workspace (`shared-contracts`, `room-client-runtime`), parece mezclar la raíz del workspace —usada correctamente para resolución de módulos— con la raíz de la app, que debería usarse para el *asset server* HTTP que sirve íconos e imágenes. No se revisó el código fuente de `withNxMetro` a fondo.

**Descartado como causa**: no es haber corrido el comando desde la carpeta equivocada — se confirmó que se ejecutaba desde `apps/mobile`.

**Recomendación** (futuro change): revisar el manejo de `server.rootPath` vs `projectRoot` de `withNxMetro`/`@nx/expo` en `metro.config.js`. Como workaround más simple, probar apuntar `app.json` a paths absolutos, o verificar si actualizar `@nx/expo` a una versión más reciente ya lo corrige.
