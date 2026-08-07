## MODIFIED Requirements

### Requirement: Automated build and deploy to AWS on relevant changes
The system SHALL automatically run `sam build` and `sam deploy` for the `realtime-api` backend whenever changes are pushed to `master` (ambiente `prod`) or to any branch matching `release/**` (ambiente `qa`) that touch `apps/realtime-api/**`, `packages/shared-contracts/**`, or `infra/**`. Pushes to `develop` (ambiente `dev`) SHALL NOT trigger an automatic deploy. The system SHALL also support manual re-deployment on demand to any of the three environments, including `dev`.

#### Scenario: Push to master touching backend code triggers a prod deployment
- **WHEN** a commit pushed to `master` modifies a file under `apps/realtime-api/`
- **THEN** a GitHub Actions workflow runs `sam build` and `sam deploy --config-env prod`

#### Scenario: Push to a release branch touching backend code triggers a qa deployment
- **WHEN** a commit pushed to a branch matching `release/**` modifies a file under `apps/realtime-api/`
- **THEN** the same backend deploy workflow runs `sam build` and `sam deploy --config-env qa`, overwriting whatever was previously deployed to the qa stack

#### Scenario: Push to develop does not trigger an automatic deployment
- **WHEN** a commit is pushed to `develop`
- **THEN** the backend deploy workflow does not run automatically

#### Scenario: Push touching shared contracts triggers deployment
- **WHEN** a commit pushed to `master` or to a `release/**` branch modifies a file under `packages/shared-contracts/`
- **THEN** the same backend deploy workflow runs against the corresponding environment, so the Lambda functions (which depend on `shared-contracts` for validation) pick up the change

#### Scenario: Push touching only frontend code does not trigger backend deployment
- **WHEN** a commit pushed to `master`, a `release/**` branch, or `develop` only modifies files under `apps/web/`
- **THEN** the backend deploy workflow does not run

#### Scenario: Manual deploy to any environment
- **WHEN** a maintainer triggers the backend deploy workflow manually (`workflow_dispatch`) selecting an `environment` input (`dev`, `qa`, or `prod`)
- **THEN** the same build-and-deploy process runs against the selected environment's stack without requiring a new commit

## ADDED Requirements

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
