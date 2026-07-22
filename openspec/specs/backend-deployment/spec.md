# Backend Deployment

## Purpose

TBD

## Requirements

### Requirement: Automated build and deploy to AWS on relevant changes
The system SHALL automatically run `sam build` and `sam deploy` for the `realtime-api` backend whenever changes are pushed to `master` that touch `apps/realtime-api/**`, `packages/shared-contracts/**`, or `infra/**`, and SHALL also support manual re-deployment on demand.

#### Scenario: Push touching backend code triggers deployment
- **WHEN** a commit pushed to `master` modifies a file under `apps/realtime-api/`
- **THEN** a GitHub Actions workflow runs `sam build` and `sam deploy` against the `poker-planning-dev` stack

#### Scenario: Push touching shared contracts triggers deployment
- **WHEN** a commit pushed to `master` modifies a file under `packages/shared-contracts/`
- **THEN** the same backend deploy workflow runs, so the Lambda functions (which depend on `shared-contracts` for validation) pick up the change

#### Scenario: Push touching only frontend code does not trigger backend deployment
- **WHEN** a commit pushed to `master` only modifies files under `apps/web/`
- **THEN** the backend deploy workflow does not run

#### Scenario: Manual redeploy
- **WHEN** a maintainer triggers the backend deploy workflow manually (workflow_dispatch)
- **THEN** the same build-and-deploy process runs without requiring a new commit

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
