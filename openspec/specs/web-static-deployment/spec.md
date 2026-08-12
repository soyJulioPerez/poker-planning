# Web Static Deployment

## Purpose

TBD
## Requirements
### Requirement: Automated build and publish to GitHub Pages

El sistema SHALL construir la app `web` y publicarla en GitHub Pages cuando se pushea a `master`, **siempre que la verificación haya pasado primero** —`lint`, `test`, `build` y, cuando el cambio la alcance, la suite end-to-end— y que `web` resulte afectada según el grafo de dependencias de Nx. El sistema SHALL seguir soportando el re-despliegue manual bajo demanda.

**Qué cambia respecto de la versión anterior**: la verificación previa incluye ahora los tests end-to-end. Un cambio en la web que compila y pasa los unitarios pero rompe el flujo de una sala **no se publica**.

Que la suite end-to-end no se haya ejecutado —porque el cambio no la alcanzaba— SHALL NOT impedir la publicación. Solo un fallo la impide.

**Qué se conserva de la versión anterior**: la publicación no es incondicional (espera a la verificación) ni indiscriminada (el grafo decide si la web cambió).

#### Scenario: Push to main triggers deployment
- **WHEN** se pushea un commit a `master` que afecta a `web` según el grafo
- **AND** las tareas de `lint`, `test` y `build` de los proyectos afectados pasan
- **AND** la suite end-to-end pasa
- **THEN** un workflow de GitHub Actions construye `web` y publica la salida en GitHub Pages

#### Scenario: Un cambio que no afecta a la web no la republica
- **WHEN** se pushea a `master` un commit que solo modifica `apps/realtime-api/` o `docs/`
- **THEN** el sitio publicado queda como está, sin una republicación idéntica

#### Scenario: La verificación en rojo impide la publicación
- **WHEN** se pushea a `master` un commit que rompe un test o el lint
- **THEN** el sitio publicado queda como estaba, y el fallo es visible antes de que nadie lo vea desplegado

#### Scenario: Un e2e roto impide la publicación
- **WHEN** se pushea a `master` un commit que afecta a `web` y rompe un test end-to-end
- **THEN** el sitio publicado queda como estaba

#### Scenario: Manual redeploy
- **WHEN** alguien dispara el workflow manualmente (`workflow_dispatch`)
- **THEN** el mismo proceso de build y publicación corre sin necesidad de un commit nuevo

### Requirement: Correct asset resolution at subpath
The deployed app SHALL load all scripts, styles, and assets correctly when served from the `https://<user>.github.io/poker-planning/` subpath.

#### Scenario: App loads at Pages subpath
- **WHEN** a user navigates to `https://<user>.github.io/poker-planning/`
- **THEN** the page loads with all JS/CSS/asset requests resolving under `/poker-planning/` (no 404s for app assets)

### Requirement: SPA deep-link fallback
The system SHALL serve the application shell for any unmatched path so that Angular Router can resolve client-side routes, since GitHub Pages does not support server-side rewrites.

#### Scenario: Direct load of a room URL
- **WHEN** a user directly navigates to or refreshes `https://<user>.github.io/poker-planning/room/abc123`
- **THEN** GitHub Pages serves the app shell (via `404.html`) and the Angular Router renders the room page for `roomId=abc123`

### Requirement: No backend changes required
The deployment SHALL NOT require any changes to `realtime-api` or its AWS infrastructure; the deployed frontend SHALL continue using the existing production WebSocket endpoint.

#### Scenario: WebSocket connectivity unaffected
- **WHEN** the GitHub Pages–hosted app connects to the realtime backend
- **THEN** it connects successfully to the existing `wss://` API Gateway endpoint with no backend redeployment

