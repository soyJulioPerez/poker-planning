## MODIFIED Requirements

### Requirement: Automated build and deploy to AWS on relevant changes

El sistema SHALL ejecutar `sam build` y `sam deploy` del backend `realtime-api` cuando se pushea a `master` (ambiente `prod`) o a una rama `release/**` (ambiente `qa`), **siempre que la verificación de `lint`, `test` y `build` haya pasado primero** y que `realtime-api` resulte afectado según el grafo de dependencias de Nx. Los pushes a `develop` (ambiente `dev`) SHALL NOT disparar un deploy automático. El sistema SHALL seguir soportando el re-despliegue manual bajo demanda a cualquiera de los tres ambientes, incluido `dev`.

**Qué cambia respecto de la versión anterior**: qué se despliega deja de decidirse por una lista de rutas escrita a mano (`apps/realtime-api/**`, `packages/shared-contracts/**`, `infra/**`) y pasa a decidirse por el grafo real. La lista era una aproximación que había que mantener: si `realtime-api` empezara a depender de otro paquete del workspace, el filtro no se enteraría y el deploy se saltearía en silencio.

Y el deploy pasa a estar **encadenado detrás de la verificación**, no en paralelo con ella.

#### Scenario: Push to master touching backend code triggers a prod deployment
- **WHEN** un commit pusheado a `master` modifica un archivo bajo `apps/realtime-api/`
- **AND** las tareas de `lint`, `test` y `build` de los proyectos afectados pasan
- **THEN** el workflow ejecuta `sam build` y `sam deploy --config-env prod`

#### Scenario: La verificación en rojo impide el deploy
- **WHEN** un commit pusheado a `master` modifica el backend y rompe un test
- **THEN** el deploy no se ejecuta, y el stack de `prod` queda como estaba

#### Scenario: Push to a release branch touching backend code triggers a qa deployment
- **WHEN** un commit pusheado a una rama `release/**` modifica un archivo bajo `apps/realtime-api/`
- **AND** la verificación pasa
- **THEN** el mismo flujo ejecuta `sam build` y `sam deploy --config-env qa`, sobrescribiendo lo que hubiera en el stack de qa

#### Scenario: Push to develop does not trigger an automatic deployment
- **WHEN** se pushea un commit a `develop`
- **THEN** la verificación corre, pero el deploy de backend no se ejecuta

#### Scenario: Push touching shared contracts triggers deployment
- **WHEN** un commit pusheado a `master` o a una rama `release/**` modifica un archivo bajo `packages/shared-contracts/`
- **THEN** el grafo marca a `realtime-api` como afectado —depende de `shared-contracts` para validación— y el deploy corre contra el ambiente correspondiente

#### Scenario: Push touching only frontend code does not trigger backend deployment
- **WHEN** un commit pusheado a `master`, a una rama `release/**` o a `develop` modifica únicamente archivos bajo `apps/web/`
- **THEN** el grafo no marca a `realtime-api` como afectado y el deploy de backend no corre

#### Scenario: Una dependencia nueva del backend entra al alcance sola
- **WHEN** `realtime-api` pasa a depender de un proyecto del workspace del que no dependía
- **THEN** un cambio en ese proyecto marca a `realtime-api` como afectado y dispara su deploy, sin que nadie haya tenido que actualizar una lista de rutas

#### Scenario: Manual deploy to any environment
- **WHEN** alguien dispara el workflow de deploy de backend manualmente (`workflow_dispatch`) eligiendo un `environment` (`dev`, `qa` o `prod`)
- **THEN** el proceso de build y deploy corre contra el stack del ambiente elegido, sin necesidad de un commit nuevo

#### Scenario: El deploy manual no corre la verificación
- **WHEN** alguien despliega un tag anterior a `prod` mediante `workflow_dispatch` con el input `ref`, para hacer rollback
- **THEN** se despliega ese ref y nada más: no se ejecuta la verificación del código actual de la rama, que no es el que se está desplegando
