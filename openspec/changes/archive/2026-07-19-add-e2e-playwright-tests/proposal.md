## Why

Hoy no existe ninguna suite de tests end-to-end para la aplicación: los tests unitarios de `apps/web` están rotos (deuda documentada en `docs/known-issues.md`) y `apps/realtime-api` no tiene infraestructura de test runner (deuda documentada en `docs/future-ideas.md`). Toda la verificación de flujos completos (crear sala, votar, revelar, resolver) se viene haciendo manualmente en el navegador — incluso vía Playwright MCP en sesiones recientes, de forma ad-hoc y no repetible. `@playwright/test` y `@nx/playwright` ya están instalados en el repo (parte del preset de Nx) pero sin ningún proyecto configurado que los use.

Además, `apps/web` se despliega hoy a GitHub Pages en cada push a `master` (`.github/workflows/deploy-web.yml`), corriendo `nx build web --base-href=/poker-planning/` sin especificar `--configuration`. Introducir Angular environments sin ajustar ese workflow rompería el sitio público en producción, ya que el build de CI tomaría el mismo default que se define para desarrollo local.

## What Changes

- Se agrega un proyecto Nx `e2e` (integración, separado de `apps/web` y `apps/realtime-api`) con tests end-to-end reales usando Playwright, cubriendo los flujos principales de la aplicación (crear sala, unirse, votar, revelar, resolver una historia).
- Se introduce el mecanismo estándar de Angular environments en `apps/web` (`environment.ts` por defecto, más una configuración adicional), reemplazando la constante `WEBSOCKET_URL` hardcodeada (con línea comentada para alternar manualmente) en `room-socket.service.ts`. El comportamiento por defecto (sin flag) pasa a apuntar al backend local — decisión mantenida deliberadamente por priorizar la comodidad del día a día en desarrollo.
- `.github/workflows/deploy-web.yml` se actualiza para especificar explícitamente `--configuration=aws` (o el nombre decidido) en el paso de build, en vez de depender del default silencioso — así el sitio público en GitHub Pages sigue apuntando a AWS sin importar cuál sea el default de `environment.ts`.
- Los tests e2e pueden correr contra dos backends distintos mediante un parámetro de configuración: **local** (DynamoDB Local + `nx serve realtime-api`, orquestado automáticamente antes de correr los tests) o **AWS** (el stack ya desplegado, sin orquestar nada del lado del backend).
- **BREAKING** (solo para desarrollo local, no afecta producción): quien trabaje en el repo y dependa hoy de editar manualmente la línea comentada en `room-socket.service.ts` para alternar entre local/AWS deberá usar la configuración de Angular en su lugar.

## Capabilities

### New Capabilities
(ninguna — este cambio es infraestructura de testing, sin comportamiento observable de la aplicación)

### Modified Capabilities
(ninguna — no se toca ningún requirement de dominio bajo `openspec/specs/`)

## Impact

- Nuevo proyecto Nx `e2e/` con su propio `project.json`, `playwright.config.ts` y specs de test.
- `apps/web/src/environments/`: nuevos archivos `environment.ts` (default → local) y `environment.aws.ts` (o similar).
- `apps/web/project.json`: nueva configuración de build/serve para apuntar a AWS (`fileReplacements`), o mecanismo equivalente.
- `apps/web/src/app/core/room-socket.service.ts`: deja de tener `WEBSOCKET_URL` hardcodeada, la lee desde `environment`.
- `package.json`: nuevos scripts para correr e2e contra local o AWS.
- `docs/local-dev-workflow.md`: posible actualización para mencionar el nuevo flujo de e2e, si aplica.
- `.github/workflows/deploy-web.yml`: el paso "Build web" pasa a especificar explícitamente la configuración de AWS/producción, en vez de depender del default de `nx build web`.
- Depende de `fix-local-api-dev-server` (ya archivado): el arranque orquestado del backend local para el modo "local" de e2e usa `nx serve realtime-api`, el mismo mecanismo que ese change dejó funcionando.
- No afecta el despliegue a AWS del backend (`infra/template.yaml`, `sam build`/`sam deploy`) — ese flujo es completamente independiente de `apps/web` y de este change.
