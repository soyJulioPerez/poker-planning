## MODIFIED Requirements

### Requirement: Automated build and publish to GitHub Pages

El sistema SHALL construir la app `web` y publicarla en GitHub Pages cuando se pushea a `master`, **siempre que la verificación de `lint`, `test` y `build` haya pasado primero** y que `web` resulte afectada según el grafo de dependencias de Nx. El sistema SHALL seguir soportando el re-despliegue manual bajo demanda.

**Qué cambia respecto de la versión anterior**, en dos frentes:

1. La publicación deja de ser **incondicional**: antes, un push a `master` disparaba build y publicación en paralelo con cualquier verificación, así que un fallo de tests se descubría después de que el sitio ya estaba actualizado.
2. La publicación deja de ser **indiscriminada**: antes, cualquier push a `master` republicaba el sitio aunque el cambio hubiera sido solo del backend o de documentación.

#### Scenario: Push to main triggers deployment
- **WHEN** se pushea un commit a `master` que afecta a `web` según el grafo
- **AND** las tareas de `lint`, `test` y `build` de los proyectos afectados pasan
- **THEN** un workflow de GitHub Actions construye `web` y publica la salida en GitHub Pages

#### Scenario: Un cambio que no afecta a la web no la republica
- **WHEN** se pushea a `master` un commit que solo modifica `apps/realtime-api/` o `docs/`
- **THEN** el sitio publicado queda como está, sin una republicación idéntica

#### Scenario: La verificación en rojo impide la publicación
- **WHEN** se pushea a `master` un commit que rompe un test o el lint
- **THEN** el sitio publicado queda como estaba, y el fallo es visible antes de que nadie lo vea desplegado

#### Scenario: Manual redeploy
- **WHEN** alguien dispara el workflow manualmente (`workflow_dispatch`)
- **THEN** el mismo proceso de build y publicación corre sin necesidad de un commit nuevo
