# Los e2e entran al portón de CI

## Why

El portón que dejó la Fase 1.1 corre `lint`, `test` y `build`. Los tres specs de Playwright —12 tests activos sobre el flujo completo de una sala— **solo corren si alguien se acuerda de correrlos a mano**. Esa es exactamente la definición de una suite que se va a pudrir: la única capa que prueba que web y backend hablan entre sí es la que nadie ejecuta.

**Por qué ahora**: el portón ya existe, ya es verde, y ya sabe acotar por grafo. Agregar e2e es sumarle una etapa a algo que funciona, no armar nada nuevo.

**Y una razón que apareció al explorar**: hoy `e2e` **no depende de nadie** en el grafo (`implicitDependencies: []`, y sus page objects no importan código de `web`). Si el job se resolviera por `nx affected` sin corregir eso, no correría casi nunca — y tendríamos un check verde que no prueba nada, que es peor que no tenerlo.

## What Changes

**El grafo aprende que los e2e dependen de la app**
- `e2e` declara `implicitDependencies: ["web", "realtime-api"]`. Un cambio en cualquiera de las dos —o en `shared-contracts`, que las alcanza por transitividad— marca a `e2e` como afectado.

**El stack de e2e se levanta solo**
- Se agrega `E2E_TARGET=ci` a [e2e/playwright.config.mts](../../../e2e/playwright.config.mts): un modo que arranca `web` y `realtime-api` desde artefactos ya construidos, vía `webServer`. Hoy el modo `local` **no orquesta nada** y asume que las tres piezas ya están arriba.
- DynamoDB Local sigue siendo un prerrequisito externo (es un contenedor, no un proceso), pero queda detrás de un solo comando reproducible en local.

**El job de e2e entra al pipeline en paralelo con `verify`**
- Job propio en `ci.yml`, no un step de `verify`: el feedback de lint/test no espera a los e2e, y los e2e no esperan a lint.
- Calcula su propio alcance y **nunca queda `skipped`**: cuando `e2e` no está afectado termina en verde sin hacer nada. Un job salteado en GitHub Actions arrastra a sus dependientes al `skipped`, y eso apagaría los deploys en silencio.
- `deploy-backend` y `deploy-web` pasan a `needs: [verify, e2e]`.

**Evidencia cuando algo falla**
- `dist/.playwright/e2e/` se sube con `actions/upload-artifact`. El preset ya configura `trace: 'on-first-retry'` y `retries: 2` en CI; sin subir el artifact ese trace se genera y se tira.

**Deuda menor que va de paso** (el roadmap la asigna explícitamente a esta fase)
- `playwright.config.mts` referencia dos veces `docs/e2e-tests.md`, que no existe. El archivo es [e2e-lessons-learned.md](../../../docs/e2e-lessons-learned.md).
- Los scripts de `package.json` usan `localhost:8000` contra DynamoDB Local, que se cuelga en Windows por resolución IPv6 ([known-issues.md](../../../docs/known-issues.md)). Pasan a `127.0.0.1`.

## Capabilities

### Modified Capabilities

- `continuous-integration`: la verificación deja de ser solo `lint`/`test`/`build`. Se agregan los requisitos de cómo corren los e2e, contra qué stack, cómo se decide su alcance, qué evidencia dejan, y la garantía de que un job que no hizo falta no puede confundirse con uno que falló.
- `backend-deployment`: el requirement *"Automated build and deploy to AWS on relevant changes"* condiciona hoy el deploy a que pasen `lint`, `test` y `build`. Pasa a incluir los e2e.
- `web-static-deployment`: el requirement *"Automated build and publish to GitHub Pages"*, lo mismo.

## Impact

**Configuración**
- `e2e/project.json` — `implicitDependencies`.
- `e2e/playwright.config.mts` — modo `ci` con `webServer`, y las dos referencias rotas a docs.
- `package.json` — script de reproducción local del modo `ci`, y `localhost` → `127.0.0.1`.
- `.github/workflows/ci.yml` — job `e2e`, y `needs:` de los dos jobs de deploy.

**Sin cambios de código de aplicación.** Nada de `src/`, ni de los specs salvo lo que decida la tarea del test inestable.

**Lo que NO hay que configurar**, porque [el preset de Nx ya lo hace](../../../node_modules/@nx/playwright/dist/src/utils/preset.js) cuando detecta `CI`: `retries: 2`, `workers: 1`, `forbidOnly`, y el reporter `blob`.

**Riesgo conocido y cuantificado**: `room-moderation.spec.ts:158` está activo y [known-issues.md](../../../docs/known-issues.md) lo documenta fallando ~2 de cada 3 corridas aisladas. Con `retries: 2` eso serían ~30% de corridas rojas sin culpa del PR. El diagnóstico fue en Windows con procesos zombie reteniendo puertos; un runner limpio puede no reproducirlo. Se decide con evidencia, no antes (ver `design.md`, Decisión 5).

**Fuera de alcance**
- La branch protection es la Fase 1.3. Este change agrega un check más; cuáles son obligatorios se decide allá.
- Investigar la causa raíz de los dos tests inestables. Están documentados y emparentados en `known-issues.md`; es un change propio.
- Nx Cloud / agentes distribuidos. La atomización de `e2e-ci` existe para eso y sin ellos no compra nada (ver Decisión 4).
- Los tests de integración contra DynamoDB Local son la Fase 2.2. Este change deja la infra montada, que es lo que esa fase da por hecho.
