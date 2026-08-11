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

**Recomendación**: subir `node-version: 20` → `24` (o `lts/*`) en los 3 workflows (`deploy-backend.yml`, `build-mobile.yml`, `deploy-web.yml`), en línea con el runtime que ya usan las Lambdas (`nodejs24.x` en `infra/template.yaml`). No aplicado en `add-multi-environment-deployment` por estar fuera de su alcance.

## Accesibilidad de `participant-list`: además, bloquea el lint en CI

**Actualizado**: 2026-08-10.

Los 2 errores de `@angular-eslint/template` en `apps/web/src/app/ui/participant-list/participant-list.html:18` —`click-events-have-key-events` e `interactive-supports-focus`— dejaron de ser solo deuda de accesibilidad.

Desde el change `enable-module-boundaries`, que llevó los errores de `@nx/enforce-module-boundaries` de 30 a 0, **son lo único que mantiene `nx lint` en rojo en todo el workspace**:

| Proyecto | Estado |
|---|---|
| `shared-contracts`, `room-client-runtime`, `mobile`, `realtime-api`, `e2e` | ✅ verde |
| `web` | ❌ 2 errores de accesibilidad |

Eso los convierte en **bloqueante de la Fase 1.1** del [roadmap](hardening-roadmap.md): el gate de CI corre `nx affected -t lint test build`, así que mientras sigan ahí, todo PR que toque `web` nace en rojo.

El detalle de qué hay que cambiar está más abajo, en "Otros elementos sin ARIA suficiente". Lo que cambia con esta nota es la **prioridad**: no es una mejora deseable, es un prerrequisito de pipeline.

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

## `nx build mobile` borra el lockfile de mobile, aunque falle

**Detectado**: 2026-08-10.

**Síntoma**: después de correr `npx nx build mobile`, el working tree queda sucio sin que uno haya editado nada:

```
 D apps/mobile/package-lock.json      # el original, de 24.042 líneas
 M apps/mobile/package.json           # + "devDependencies": {}, y sin newline final
```

Las dos marcas delatan una reescritura por `JSON.stringify`: una clave vacía que no estaba y el salto de línea final perdido.

**Causa**: el executor `@nx/expo:build` copia el `package.json` y el lockfile **de la raíz** dentro de `apps/mobile/` antes de invocar `eas` —para que EAS en la nube vea el árbol de dependencias completo— y los restaura al terminar:

```js
// node_modules/@nx/expo/dist/src/executors/build/build.impl.js:18
resetLocalFunction = copyPackageJsonAndLock(detectPackageManager(context.root), context.root, projectRoot);
await runCliBuild(context.root, projectRoot, options);
} finally {
    resetLocalFunction();   // restaura, pero mal
```

La restauración es defectuosa: reescribe `package.json` desde un objeto en memoria (de ahí el formato normalizado) y no repone el lockfile original, que quedó pisado por el de la raíz.

**Ocurre incluso cuando el build falla.** Sin `eas-cli` instalado, el comando muere con `EAS is not installed` y el `finally` corre igual, dejando el destrozo.

**Aislado por descarte** (restaurando los archivos y corriendo cada candidato por separado): `nx export mobile` no lo produce, `npm install` en la raíz tampoco. Solo `nx build mobile`.

**Impacto**: en CI el daño es efímero (el checkout se descarta, no hay commit). En local es real y silencioso — el efecto no tiene ninguna relación visible con el comando que lo causó, así que es fácil commitearlo sin darse cuenta. `apps/mobile` no es un workspace de npm (el `package.json` raíz no declara `workspaces`), así que ese lockfile es suyo y no se regenera solo.

**Recomendación**: correr el generador oficial, que además resuelve que el executor esté deprecado (`@nx/expo:build` se elimina en Nx v24 — el propio comando lo avisa):

```bash
npx nx g @nx/expo:convert-to-inferred
```

Es prerrequisito de la Fase 1.1 del [roadmap](hardening-roadmap.md): `nx affected -t build` incluye a mobile cada vez que se toca `packages/shared-contracts`.

**Si ya pasó**: `git checkout -- apps/mobile/` restaura los dos archivos íntegros.

## Botón "Nueva ronda" sin accessible name descriptivo

**Síntoma**: el botón "↻" del panel de revelado (`apps/web/src/app/ui/reveal-panel/reveal-panel.html`) tiene `title="Nueva ronda"`, pero su accessible name real (según ARIA/accessible-name computation) es el texto de contenido visible "↻", no el `title`. Cualquier código que intente ubicarlo por nombre accesible "Nueva ronda" (por ejemplo `getByRole('button', { name: 'Nueva ronda' })` en Playwright) no lo encuentra, porque el contenido de texto tiene prioridad sobre `title` en el cálculo del accessible name.

**Confirmado en**: `openspec/changes/add-e2e-estimation-rules-coverage` — el test e2e de "nueva ronda" tuvo que usar el selector `page.locator('button.reveal-panel__new-round')` como workaround en vez de `getByRole` por nombre.

**Impacto**: además de complicar los selectores de test, lectores de pantalla anuncian el botón como "↻" (un carácter sin significado semántico) en vez de "Nueva ronda", afectando la accesibilidad real de la app, no solo la testeabilidad.

**Recomendación**: agregar `aria-label="Nueva ronda"` al `<button class="reveal-panel__new-round">` (además o en reemplazo del `title` existente), de forma que el accessible name sea "Nueva ronda" tanto para lectores de pantalla como para selectores de test basados en rol/nombre. No aplicado en este change por ser un ajuste de `apps/web` fuera de alcance de un change de testing puro.

## Otros elementos sin ARIA suficiente (relevado junto con el caso anterior)

Al revisar `apps/web/src/app/ui/reveal-panel/reveal-panel.html` por el botón "Nueva ronda", se relevó el resto de la UI en busca del mismo patrón (contenido visible = un emoji/ícono sin texto, sin `aria-label` que lo explique). `apps/web/src/app/ui/help-button/help-button.html` y `help-modal.html` ya siguen la práctica correcta (`aria-label="Abrir guía de estimación"`, `aria-label="Cerrar guía de estimación"`) — sirven de referencia del patrón a aplicar en los siguientes:

- **`apps/web/src/app/ui/moderator-badge/moderator-badge.ts`**: `<span class="moderator-badge" title="Moderador">🧙</span>`. Un `title` en un `<span>` no participa del accessible name de forma confiable para todos los lectores de pantalla (a diferencia de un `<button>`/control interactivo). **Recomendación**: agregar `role="img" aria-label="Moderador"` al span, para que se anuncie como "Moderador" y no como una interpretación literal del emoji (ej. "mago").

- **`apps/web/src/app/ui/participant-list/participant-list.html`** (línea `<span class="participant-list__icon">{{ participant.icon }}</span>`): el ícono elegido por el participante (ver capability `participant-identity`) se renderiza sin ningún label, antes del nombre. **Recomendación**: agregar `aria-hidden="true"` si se considera puramente decorativo (el nombre ya identifica al participante y el ícono no aporta información nueva), o `role="img" aria-label="Ícono de {{ participant.name }}"` si se prefiere que sea anunciado explícitamente. Se recomienda la primera opción (`aria-hidden`) para no duplicar información ya presente en el nombre.

- **`apps/web/src/app/ui/icon-picker/icon-picker.html`**: la grilla de selección de ícono (usada al crear sala y al unirse, ver capability `participant-identity`) renderiza cada `<button>` con el emoji como único contenido, sin `aria-label` que indique qué ícono representa cada botón, y sin `aria-pressed` para comunicar cuál está seleccionado (la selección solo se distingue visualmente vía `icon-picker__item--selected`). **Recomendación**: agregar `[attr.aria-label]="'Ícono ' + icon"` (o una descripción más rica si en el futuro el catálogo de íconos define nombres, ej. "Perro" en vez de "🐶") y `[attr.aria-pressed]="icon === selectedIcon()"` a cada botón.

## Test e2e inestable: reconexión automática (marcado `test.fixme`)

**Síntoma**: el test `reconexión automática restaura el voto sin necesidad de re-votar` (`e2e/room-moderation.spec.ts`) falla de forma intermitente con `TimeoutError: page.waitForURL: Timeout 10000ms exceeded`, esperando la navegación a `/room/<código>` justo después de que el **moderador** crea la sala — es decir, falla en el paso más básico del test, antes incluso de llegar a la lógica de reconexión en sí.

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

**No investigado a fondo**: no se determinó la causa raíz. Hipótesis sin confirmar: el test abre un segundo `browser.newContext()` (proceso Chromium adicional) antes de que el moderador termine de crear la sala, lo que podría introducir contención de recursos o una condición de carrera con el WebSocket local de desarrollo.

**Recomendación** (futuro change): investigar en conjunto con "Test e2e inestable: reconexión automática" más arriba — mismo punto de falla, mismo archivo, probablemente la misma causa. No bloquear changes no relacionados por estos flakes.

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
