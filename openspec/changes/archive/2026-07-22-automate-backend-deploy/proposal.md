## Why

Deploying the `realtime-api` backend today requires a maintainer to run `sam build && sam deploy` manually from their own machine, using their own locally-configured AWS credentials. This has already caused a production bug: after updating the shared icon catalog in `packages/shared-contracts`, the frontend deployed automatically via the existing GitHub Actions workflow while the backend lagged behind until someone remembered to redeploy it by hand, causing valid icons to be silently rejected by server-side validation. As the frontend deploy is fully automated on every push to `master`, the backend should be too, so both halves of the system stay in sync without relying on a human remembering an extra manual step.

## What Changes

- Add a new GitHub Actions workflow (`deploy-backend.yml`) that runs `sam build && sam deploy` whenever `apps/realtime-api/**` or `packages/shared-contracts/**` change on `master`.
- Authenticate the workflow to AWS using OpenID Connect (OIDC) federation instead of long-lived access keys: GitHub Actions requests a short-lived token that an IAM Role trusts, scoped to this repository.
- Document, in a dedicated setup guide, the one-time manual steps to create the OIDC identity provider and IAM Role in AWS (this cannot be automated by the workflow itself, since the workflow needs the role to exist before it can run), including the underlying trust-federation mechanism so a maintainer understands *why* each step is required, not just what to click/type.
- The workflow only builds and deploys; it does not create AWS account-level resources (OIDC provider, IAM role) — those are pre-requisites set up once, outside of CI.

### Modified Capabilities
(none — `web-static-deployment` is unaffected; this change only adds new automation for the backend)

### New Capabilities
- `backend-deployment`: automated build and deploy of the `realtime-api` backend to AWS via GitHub Actions, triggered by pushes to `master` that touch backend or shared-contracts code, authenticated via OIDC.

## Impact

- **New file**: `.github/workflows/deploy-backend.yml`
- **New file**: a setup guide (e.g. `docs/aws-oidc-setup.md`) with step-by-step instructions and the theory behind GitHub's OIDC federation with AWS IAM
- **AWS resources** (created manually, once, following the guide — not by the workflow): an IAM OIDC Identity Provider for `token.actions.githubusercontent.com`, and an IAM Role trusted by that provider and scoped to `repo:soyJulioPerez/poker-planning:*`, with permissions limited to what `sam deploy` needs for the resources in `infra/template.yaml` (Lambda, API Gateway v2, DynamoDB, IAM role creation for the functions, CloudFormation).
- **No application code changes** — this is CI/infrastructure automation only, `apps/realtime-api` and `packages/shared-contracts` are unaffected.
- **Existing manual `sam deploy` workflow** becomes optional (still usable for local/manual redeploys, e.g. via `workflow_dispatch` as a fallback) but is no longer required for normal changes to reach production.
