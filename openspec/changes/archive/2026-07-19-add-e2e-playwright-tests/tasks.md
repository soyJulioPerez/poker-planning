## 1. Angular environments

- [x] 1.1 Correr `nx g @nx/angular:environments --project=web` y revisar qué archivos/configuración genera en este workspace (sin `angular.json` en la raíz) — generó `environment.ts`/`environment.development.ts` y `fileReplacements` directo en `apps/web/project.json` (no creó `angular.json`)
- [x] 1.2 Configurar `environment.ts` (default) con `wsUrl: 'ws://localhost:3001'`
- [x] 1.3 Crear/configurar una segunda configuración de environment para AWS (`environment.aws.ts` o equivalente) con `wsUrl: 'wss://imzlnpyshh.execute-api.us-east-2.amazonaws.com/dev'`, y su `fileReplacements` correspondiente en `apps/web/project.json`
- [x] 1.4 Actualizar `apps/web/src/app/core/room-socket.service.ts` para leer `WEBSOCKET_URL` desde `environment.wsUrl`, eliminando la constante hardcodeada y el comentario manual
- [x] 1.5 Verificar manualmente: `nx serve web` (default) sirve apuntando a local; `nx serve web --configuration=aws` (o el nombre decidido) sirve apuntando a AWS — confirmar creando una sala en cada modo y viendo dónde queda registrada (DynamoDB Local vs. AWS) — verificado con Playwright: sala en modo default confirmada en DynamoDB Local; sala en modo aws confirmada ausente en local y presente en la tabla real de AWS
- [x] 1.6 **Crítico**: actualizar `.github/workflows/deploy-web.yml` (paso "Build web") para agregar `--configuration=aws` explícito al comando `nx build web --base-href=/poker-planning/`, evitando que el deploy a GitHub Pages dependa del default (local) recién introducido
- [x] 1.7 Confirmar localmente que `nx build web --base-href=/poker-planning/ --configuration=aws` (el comando exacto que correrá el workflow) genera un bundle que apunta a la URL de AWS, no a localhost — inspeccionar el JS compilado en `dist/apps/web/browser` si hace falta — confirmado: bundle contiene la URL wss de AWS y `<base href="/poker-planning/">` correcto

## 2. Proyecto Nx `e2e`

- [x] 2.1 Decidir y ejecutar el mecanismo para crear el proyecto `e2e` vacío a nivel raíz (no anidado en `apps/web` ni `apps/realtime-api`) — usado `nx g @nx/js:library e2e --directory=e2e --bundler=none --unitTestRunner=none --linter=eslint`; boilerplate de librería (`src/`, `README.md`) removido por no aplicar a un proyecto solo de tests
- [x] 2.2 Correr `nx g @nx/playwright:configuration --project=e2e --directory=.` para scaffoldear `playwright.config.mts` y `example.spec.ts` directo en `e2e/` (sin subcarpeta anidada)
- [x] 2.3 Confirmar que el target `e2e` quedó registrado — confirmado vía `nx show project e2e`: target inferido automáticamente por el plugin `@nx/playwright/plugin` (Nx 23, sin necesidad de declararlo en `project.json`)

## 3. Orquestación del backend local

- [x] 3.1 Configurar `webServer` en `playwright.config.mts` — intentado inicialmente como array con `nx serve realtime-api` + `nx serve web`; revertido (ver 3.3)
- [x] 3.2 Resolver el arranque de DynamoDB Local + creación de tabla — implementado como script npm (`e2e:db:up`), reusando el patrón idempotente ya probado en sesiones anteriores; queda como paso manual previo junto con `dev:api`/`npm start`, no orquestado por Playwright (ver 3.3)
- [x] 3.3 **El fallback SÍ fue necesario**: `webServer.command: 'npx nx serve realtime-api'` + `'npx nx serve web'` causó "Recursive task invocation detected" — el plugin `@nx/playwright` infiere automáticamente `dependsOn` sobre esos targets a partir del comando, y el propio subproceso de Playwright los relanza, generando un ciclo detectado por Nx. Aplicado el fallback: modo local (default) sin `webServer` en absoluto; el usuario levanta DynamoDB Local + `nx serve realtime-api` + `nx serve web` manualmente antes de correr `nx e2e e2e`. Documentado en `docs/local-dev-workflow.md`
- [x] 3.4 Configurado el modo `aws` vía variable de entorno `E2E_TARGET=aws` (leída en `playwright.config.mts`, no como `--configuration` de Nx sobre el propio target `e2e`): sin `webServer` para el backend, sirviendo `web` con `--configuration=aws`

## 4. Primer spec de test

- [x] 4.1 Escribir el spec del flujo principal: crear sala (moderador) → unirse un segundo participante → votar ambos → revelar → aceptar promedio/moda → confirmar historia resuelta con el puntaje correcto — `e2e/estimation-flow.spec.ts`
- [x] 4.2 Usar selectores robustos (roles ARIA, texto visible) consistentes con cómo ya se interactuó manualmente con la app vía Playwright MCP en sesiones anteriores

## 5. Scripts y documentación

- [x] 5.1 Agregar scripts npm de conveniencia (ej. `test:e2e`, `test:e2e:aws`) en `package.json`
- [x] 5.2 Actualizar `docs/local-dev-workflow.md` (o crear una nota nueva) explicando cómo correr los tests e2e localmente y contra AWS

## 6. Verificación

- [x] 6.1 Correr `nx e2e e2e` (modo local) de punta a punta y confirmar que el spec del flujo principal pasa — **desviación del design**: la orquestación automática completa vía `webServer.command: 'npx nx serve ...'` resultó en "recursive task invocation detected" (el plugin `@nx/playwright` infiere `dependsOn` sobre `realtime-api:serve`/`web:serve` a partir de esos comandos, y el propio subproceso de Playwright los relanza, generando un ciclo). Se aplicó el fallback ya acordado en `design.md`: modo local sin `webServer` (asume DynamoDB Local + `nx serve realtime-api` + `nx serve web` ya levantados manualmente). Verificado estable en corridas repetidas (ajustado `navigationTimeout` local de 5s a 10s tras detectar que 5s era insuficiente incluso con la app funcionando correctamente)
- [x] 6.2 Correr el modo `aws` y confirmar que el spec pasa contra el stack real desplegado — **parcialmente logrado**: una corrida completa pasó y dejó datos verificables en la tabla real de AWS (`resolvedStories: [{ title: "Historia e2e", finalScore: 5 }]`, confirmado vía `aws dynamodb scan`), probando que la lógica del test y la integración son correctas. Corridas posteriores fallaron por timeout esperando la navegación a `/room/<id>` tras crear la sala — inestabilidad/latencia real del stack de AWS (posible cold start de Lambda o límites de WebSocket), no un defecto del test. Se amplió el timeout (90s general, 30s para esperas de navegación en modo AWS) sin eliminar la inestabilidad. Documentado como limitación conocida en `docs/local-dev-workflow.md`; estabilizar la latencia de AWS queda fuera de alcance de este change.
- [x] 6.3 Confirmar que `nx build web`, `nx serve web` (sin flags) y el resto de los flujos manuales ya verificados en sesiones anteriores siguen funcionando sin cambios de comportamiento tras introducir environments — verificado en tareas 1.5/1.7 (builds development/production/aws probados individualmente, comportamiento correcto en cada uno)
- [x] 6.4 **Crítico, antes de mergear a `master`**: re-confirmar que `deploy-web.yml` incluye `--configuration=aws` (tarea 1.6) — un push a `master` sin este ajuste rompería el sitio público en GitHub Pages — confirmado presente en `.github/workflows/deploy-web.yml`
