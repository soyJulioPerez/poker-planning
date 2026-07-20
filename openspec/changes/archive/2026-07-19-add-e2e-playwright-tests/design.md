## Context

`@playwright/test` y `@nx/playwright` ya están instalados en `package.json` (parte del preset de Nx), pero sin ningún proyecto ni configuración que los use — no hay carpeta `e2e/`, ni `playwright.config.ts`, ni specs de test. Toda la verificación de flujos completos de la app se hace hoy manualmente en el navegador, incluso durante esta sesión de trabajo vía Playwright MCP de forma ad-hoc (crear sala, votar, revelar, resolver), sin quedar como suite repetible.

`apps/web/src/app/core/room-socket.service.ts` tiene la URL del WebSocket hardcodeada como constante, con una línea comentada para alternar manualmente entre local (`ws://localhost:3001`) y AWS (`wss://imzlnpyshh...amazonaws.com/dev`) — el mecanismo usado en esta misma sesión para probar `tshirt-numeric-resolution` y `fix-local-api-dev-server` contra el backend local. No existe la carpeta `apps/web/src/environments/`, así que Angular no tiene ningún mecanismo de configuración por entorno hoy.

`fix-local-api-dev-server` (change ya archivado) dejó `npm run dev:api` funcionando correctamente vía `nx serve realtime-api`, resolviendo el problema de `Cannot find module 'shared-contracts'` que tenía `tsx watch`. Este change depende de esa base para poder orquestar el backend local desde los tests e2e.

`apps/web` se despliega hoy a GitHub Pages en cada push a `master` (`.github/workflows/deploy-web.yml`, paso "Build web"): corre `nx build web --base-href=/poker-planning/` **sin especificar `--configuration`**, así que toma el default del target `build` de `apps/web/project.json` (hoy `production`, sin ningún concepto de environment). Introducir environments con default=local sin ajustar ese workflow rompería el sitio público — el build de CI heredaría silenciosamente el mismo default pensado para desarrollo local.

## Goals / Non-Goals

**Goals:**
- Reemplazar `WEBSOCKET_URL` hardcodeada por Angular environments reales, generados con el generador nativo `@nx/angular:environments` (confirmado disponible en este workspace).
- Default (`environment.ts`, sin flag) apunta a local (`ws://localhost:3001`).
- Una configuración adicional apunta a AWS, seleccionable explícitamente al buildear/servir.
- Nuevo proyecto Nx `e2e` (integración, no anidado en `apps/web` ni `apps/realtime-api`) con tests Playwright cubriendo el flujo principal: crear sala → unirse un segundo participante → votar → revelar → resolver.
- Los tests e2e pueden apuntar a local o AWS mediante un parámetro/configuración, sin duplicar los specs de test.
- Para el modo local, Playwright orquesta automáticamente lo necesario antes de correr los tests (DynamoDB Local, backend, frontend) usando `webServer` en `playwright.config.ts`.

**Non-Goals:**
- No se resuelve la deuda de tests unitarios rotos de `apps/web` (`docs/known-issues.md`) ni la falta de test runner en `apps/realtime-api` (`docs/future-ideas.md`) — son problemas distintos (unitarios vs. e2e).
- No se cubre el 100% de los flujos de la app en el primer corte (ej. reconexión, cierre de sala, mazos T-Shirt) — se prioriza el flujo principal; ampliar cobertura queda como trabajo futuro.
- No se automatiza correr e2e en CI (pipeline/GitHub Actions) — este change deja la suite corrible localmente; integrarla a CI es una decisión aparte (requeriría credenciales de AWS si se quisiera correr el modo "aws" ahí).
- No se cambia el comportamiento de producción — el modo AWS de environments preserva exactamente la URL que ya se usa hoy, y el workflow de GitHub Pages se ajusta para seguir apuntando ahí explícitamente (ver Decisión 6).

## Decisions

### Decisión 1: Angular environments vía el generador nativo `@nx/angular:environments`
Se usa `nx g @nx/angular:environments --project=web` en vez de crear los archivos a mano. Confirmado con `--dry-run` que genera `apps/web/src/environments/environment.ts` (default) y `environment.development.ts`, y configura `fileReplacements`. Este repo no tiene `angular.json` en la raíz (usa `project.json` por proyecto, patrón estándar de Nx) — se verificará durante la implementación cómo el generador adapta la configuración de `fileReplacements` a `apps/web/project.json` en este contexto (Nx moderno resuelve esto vía `configurations` del target `build`/`serve`, no vía `angular.json`).

`environment.ts` (default) tendrá `wsUrl: 'ws://localhost:3001'`. Se necesitará una configuración adicional para AWS (ej. `environment.aws.ts`) — el generador nativo típicamente crea `development`/`production`; la configuración `aws` se agrega manualmente seleccionando `production` como base o creando un archivo de environment adicional con su propio `fileReplacements`, decidido durante la implementación.

**Alternativa descartada**: variable de entorno leída en runtime por Playwright, sin tocar `room-socket.service.ts`. Se descartó por decisión explícita del usuario a favor del mecanismo real de Angular — deja el propio código de producción configurable, no solo los tests.

### Decisión 2: `room-socket.service.ts` lee `WEBSOCKET_URL` desde `environment`
```ts
import { environment } from '../../environments/environment';
const WEBSOCKET_URL = environment.wsUrl;
```
Reemplaza la constante hardcodeada y el comentario manual. El comportamiento observable no cambia para quien no especifique configuración (sigue local por defecto, consistente con `nx serve web` sin flags apuntando a desarrollo).

### Decisión 3: Proyecto `e2e` separado, generado con `@nx/playwright:configuration --project=e2e --directory=.`
Se investigó `nx g @nx/playwright:configuration --project=<nombre>`, que agrega Playwright *dentro* de un proyecto existente (`--directory`, default `e2e/` relativo al proyecto). Para lograr un proyecto de integración separado (no anidado en `web` ni `realtime-api`, según decisión explícita del usuario), la implementación debe primero crear un proyecto Nx vacío (ej. `nx g @nx/js:lib e2e --directory=e2e` o similar, a confirmar) y luego correr el generador de Playwright apuntando a ese proyecto — o usar el generador con un `--project` que no exista aún y dejar que la config quede en su propia carpeta a nivel raíz. Se decide el mecanismo exacto durante la implementación, priorizando usar generadores de Nx en cada paso posible, tal como se hizo para `dev:api` en `fix-local-api-dev-server`.

**Alternativa descartada**: `e2e/` anidado dentro de `apps/web` (lo que el generador hace por defecto si se le pasa `--project=web`). Se descartó por decisión explícita del usuario — el proyecto testea la integración entre `web` y `realtime-api`, no es conceptualmente "parte de" ninguno de los dos.

### Decisión 4: Orquestación del backend local vía `webServer` (array) en `playwright.config.ts`, con Docker como paso previo separado
Playwright soporta múltiples entradas en `webServer` (confirmado: Playwright 1.61.1 instalado, API estable desde versiones tempranas), cada una con su propio `command` + `url` de healthcheck. Se usará para:
1. `nx serve realtime-api` (espera hasta que `ws://localhost:3001` acepte conexiones o el proceso indique estar listo)
2. `nx serve web` (con la configuración de environment apropiada) (espera `http://localhost:4200`)

**DynamoDB Local (Docker) queda fuera del array `webServer`** — no tiene un healthcheck HTTP simple compatible con el mecanismo de espera de Playwright, y mezclar gestión de contenedores Docker en la config de test se consideró forzado. En su lugar, se evalúa durante la implementación entre:
- (a) Un script npm (`e2e:local`) que primero corre `docker start dynamodb-local` (+ crear tabla si falta) y luego invoca `nx e2e`, con el usuario reciviendo la orquestación completa vía un solo comando.
- (b) Un `globalSetup` de Playwright que haga lo mismo programáticamente.

Se prioriza (a) por simplicidad, con (b) como alternativa si (a) resulta insuficiente (ej. no poder esperar a que DynamoDB esté realmente listo antes de que `realtime-api` intente conectar).

**Fallback acordado explícitamente con el usuario**: si la orquestación automática completa resulta demasiado compleja o frágil durante la implementación, se cae a que el usuario levante el entorno local manualmente (como se documenta hoy en `docs/local-dev-workflow.md`) antes de correr `nx e2e`, y el `playwright.config.ts` asume que ya está arriba (sin `webServer` para el backend, o con un `webServer` que solo verifica que el puerto ya esté abierto).

### Decisión 5 (revisada durante implementación): Parámetro local/AWS vía variable de entorno `E2E_TARGET`, leída en `playwright.config.mts`
**Decisión original (descartada durante implementación)**: usar configuraciones de Nx (`nx e2e e2e --configuration=aws`) sobre el target `e2e` en sí. Se abandonó porque el target `e2e` es un target *inferido* por el plugin `@nx/playwright/plugin` (Nx 23) — no se declara a mano en `project.json`, así que no hay un lugar natural donde definir `configurations.aws` para ese target sin pelear contra el mecanismo de inferencia.

**Decisión final**: el propio `playwright.config.mts` lee `process.env['E2E_TARGET']` (`'aws'` o default `'local'`) y decide programáticamente qué `webServer`(s) declarar — condicional de JS simple, sin generar sintaxis nueva de configuración. Se expone vía dos scripts npm (`test:e2e` para local, `test:e2e:aws` con `cross-env E2E_TARGET=aws`), manteniendo la experiencia de "un comando por modo" aunque el mecanismo interno sea una env var y no una `--configuration` de Nx.

### Decisión 6: `deploy-web.yml` pasa a especificar `--configuration` explícitamente, en vez de invertir el default de `environment.ts`
Se mantiene `environment.ts` (default, sin flag) apuntando a local — decisión explícita del usuario, priorizando la comodidad de `nx serve web` sin flags durante el día a día de desarrollo, por sobre el patrón más común de Angular (`production` como default implícito). Como contrapartida, el paso "Build web" de `.github/workflows/deploy-web.yml` (línea `nx build web --base-href=/poker-planning/`) se actualiza para incluir `--configuration=aws` (o el nombre final decidido) explícitamente, dejando de depender de cualquier default.

**Alternativa descartada**: invertir el default (`environment.ts` = AWS/producción, local requiere `--configuration=local` explícito). Es el patrón más convencional en Angular y hubiera dejado el workflow de CI funcionando sin tocarlo, pero se descartó por decisión explícita del usuario a favor de mantener el default optimizado para desarrollo local.

**Nota de seguridad de este enfoque**: hacer explícito el flag en CI es más seguro a largo plazo que invertir el default, porque el build de producción ya no depende de "qué configuración quedó como default" en `apps/web/project.json` — cualquier cambio futuro al default (ej. si alguien lo invierte más adelante sin darse cuenta del impacto en CI) no rompería silenciosamente el sitio público, porque el workflow ya no confía en ese default.

## Risks / Trade-offs

- [Riesgo] La orquestación completa (Decisión 4) puede resultar frágil por timing (DynamoDB Local tarda en aceptar conexiones, `realtime-api` podría arrancar antes de que la tabla exista) → Mitigación: usar el mismo patrón ya probado manualmente en esta sesión (`docker start` → esperar → `create-table` idempotente → `nx serve`), con reintentos/timeouts razonables; si sigue siendo frágil, aplicar el fallback ya acordado (usuario levanta el entorno manualmente).
- [Riesgo] Modo AWS de e2e deja datos "basura" en la tabla real de producción (salas de test) → Aceptado como limitación conocida (mismo trade-off ya identificado en la fase de exploración); mitigable a futuro con un prefijo de nombre de sala identificable como test, pero fuera de alcance de este change.
- [Trade-off] No cubrir CI en este change significa que la suite e2e no previene regresiones automáticamente en cada push, solo cuando alguien la corre localmente → Aceptado; correr e2e en CI es una decisión de infraestructura aparte (créditos de AWS, secrets, runners con Docker) que amerita su propia exploración.
- [Riesgo] Con default=local, cualquier build futuro que olvide especificar `--configuration` (no solo `deploy-web.yml`, sino cualquier script o comando manual que alguien corra) produce silenciosamente un build apuntando a `localhost` → Mitigación parcial vía Decisión 6 (CI queda explícito), pero el riesgo persiste para comandos manuales corridos sin flag por error; se acepta como trade-off consciente de priorizar la comodidad de desarrollo sobre esta protección.

## Migration Plan

Sin datos de producción afectados. Pasos de implementación:
1. Generar Angular environments (`@nx/angular:environments`), migrar `room-socket.service.ts`.
2. Verificar manualmente que `nx serve web` (default) y `nx serve web --configuration=aws` (o el nombre que se decida) sirven la URL correcta — reutilizando el mismo método de verificación de esta sesión (crear sala, confirmar en DynamoDB Local vs. comportamiento contra AWS).
3. Actualizar `.github/workflows/deploy-web.yml` para incluir `--configuration=aws` explícito en el paso de build, **antes de** mergear a `master` (para no dejar una ventana donde un push real construya con el default equivocado).
4. Crear el proyecto `e2e` y su configuración de Playwright.
5. Escribir el primer spec (flujo principal).
6. Verificar que `nx e2e e2e` (local) corre de punta a punta sin intervención manual, o documentar el fallback si no se logra.
7. Verificar `nx e2e e2e --configuration=aws` contra el stack real.
8. Antes de mergear: confirmar mediante `nx build web --base-href=/poker-planning/ --configuration=aws` (simulando exactamente el comando del workflow) que el build de producción resultante sirve la URL de AWS, no local.

Sin plan de rollback especial — cambios aditivos (nuevo proyecto, nuevos archivos de environment); revertir el commit restaura el estado anterior sin efectos secundarios.

## Open Questions

- Mecanismo exacto para crear el proyecto `e2e` vacío antes de correrle el generador de Playwright (¿`@nx/js:lib`, `@nx/node:application`, o generarlo manualmente vía `project.json`?) — a resolver en implementación, probando alternativas.
- Nombre exacto de la configuración de environment para AWS (`environment.aws.ts` vs. reusar `environment.production.ts`) — a decidir en implementación según lo que el generador nativo proponga por defecto.
- Si (a) o (b) de la Decisión 4 termina siendo la solución real para orquestar DynamoDB Local — a resolver empíricamente.
