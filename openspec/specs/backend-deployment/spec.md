# Backend Deployment

## Purpose

TBD
## Requirements
### Requirement: Automated build and deploy to AWS on relevant changes

El sistema SHALL ejecutar `sam build` y `sam deploy` del backend `realtime-api` cuando se pushea a `master` (ambiente `prod`) o a una rama `release/**` (ambiente `qa`), **siempre que la verificación haya pasado primero** —`lint`, `test`, `build` y, cuando el cambio la alcance, la suite end-to-end— y que `realtime-api` resulte afectado según el grafo de dependencias de Nx. Los pushes a `develop` (ambiente `dev`) SHALL NOT disparar un deploy automático. El sistema SHALL seguir soportando el re-despliegue manual bajo demanda a cualquiera de los tres ambientes, incluido `dev`.

**Qué cambia respecto de la versión anterior**: la verificación previa incluye ahora los tests end-to-end. Un cambio que compila, lintea y pasa los unitarios pero rompe el flujo de una sala **no llega a producción**.

Que la suite end-to-end no se haya ejecutado —porque el cambio no la alcanzaba— SHALL NOT impedir el deploy. Solo un fallo lo impide.

**Qué se conserva de la versión anterior**: qué se despliega lo decide el grafo real y no una lista de rutas escrita a mano; y el deploy está encadenado detrás de la verificación, no en paralelo con ella.

#### Scenario: Push to master touching backend code triggers a prod deployment
- **WHEN** un commit pusheado a `master` modifica un archivo bajo `apps/realtime-api/`
- **AND** las tareas de `lint`, `test` y `build` de los proyectos afectados pasan
- **AND** la suite end-to-end pasa
- **THEN** el workflow ejecuta `sam build` y `sam deploy --config-env prod`

#### Scenario: La verificación en rojo impide el deploy
- **WHEN** un commit pusheado a `master` modifica el backend y rompe un test
- **THEN** el deploy no se ejecuta, y el stack de `prod` queda como estaba

#### Scenario: Un e2e roto impide el deploy
- **WHEN** un commit pusheado a `master` modifica el backend y rompe un test end-to-end
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

### Requirement: Ambientes de backend aislados por stack de CloudFormation
El sistema SHALL mantener tres stacks de CloudFormation independientes — uno por ambiente (`dev`, `qa`, `prod`) — cada uno con su propia tabla DynamoDB, WebSocket API Gateway y funciones Lambda, de forma que los datos y cambios de infraestructura de un ambiente NO SHALL afectar a otro.

#### Scenario: Los datos de prueba de QA no aparecen en producción
- **WHEN** se crea una sala contra el stack `qa` (por ejemplo, desde un build de preview mobile o una corrida de e2e)
- **THEN** esa sala existe únicamente en la tabla DynamoDB del stack `qa` y no es visible para clientes conectados al stack `prod`

#### Scenario: Desplegar a un ambiente no redespliega otro
- **WHEN** corre `sam deploy --config-env qa`
- **THEN** solo se crean o actualizan los recursos del stack `qa`; los stacks `dev` y `prod` quedan sin tocar

### Requirement: Rollback de producción sin reescribir la historia de master
El sistema SHALL permitir re-desplegar un ref específico (commit o tag) al ambiente `prod` mediante un input manual en `workflow_dispatch`, sin requerir ningún cambio en el historial de commits de la rama `master`.

#### Scenario: Re-desplegar un tag anterior a prod
- **WHEN** un maintainer dispara el workflow de deploy backend manualmente con `environment: prod` y `ref: v1.4.0`
- **THEN** el workflow hace checkout de `v1.4.0` y lo despliega al stack `prod`, mientras el puntero de la rama `master` permanece sin cambios

### Requirement: AWS authentication via OIDC, no long-lived credentials
The system SHALL authenticate GitHub Actions to AWS using OpenID Connect (OIDC) federation and a scoped IAM Role, and SHALL NOT store long-lived AWS access keys as GitHub secrets.

#### Scenario: Workflow assumes a scoped IAM role via OIDC
- **WHEN** the backend deploy workflow runs
- **THEN** it obtains temporary AWS credentials by presenting a GitHub-issued OIDC token to an IAM Role trusted for this repository, without reading any static `AWS_SECRET_ACCESS_KEY` from GitHub secrets

#### Scenario: Credentials are scoped and short-lived
- **WHEN** the workflow finishes running
- **THEN** the temporary credentials it used expire on their own (no manual revocation required) and were limited to the permissions the IAM Role grants for this stack's resources

### Requirement: Manual bootstrap of AWS trust relationship is documented
The system SHALL provide a written setup guide describing the one-time manual steps required to create the IAM OIDC Identity Provider and IAM Role in AWS before the automated workflow can run, including the reasoning behind each step.

#### Scenario: New maintainer follows the guide to bootstrap a fresh AWS account
- **WHEN** a maintainer with AWS console/CLI access but no prior OIDC setup follows `docs/aws-oidc-setup.md`
- **THEN** they end up with an IAM OIDC Identity Provider for `token.actions.githubusercontent.com` and an IAM Role trusted only for this repository, with permissions scoped to the resources in `infra/template.yaml`

