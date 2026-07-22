## 1. AWS bootstrap (manual, one-time)

- [x] 1.1 Write `docs/aws-oidc-setup.md`: explain the OIDC trust-federation mechanism (GitHub's OIDC provider, signed JWTs, `sub`/`aud` claims, `AssumeRoleWithWebIdentity`) before the step-by-step instructions
- [x] 1.2 In the guide, provide the exact CLI/console steps to create the IAM OIDC Identity Provider for `token.actions.githubusercontent.com`
- [x] 1.3 In the guide, provide the exact trust policy JSON for the IAM Role, scoped to `repo:soyJulioPerez/poker-planning:*` via the `sub` claim condition
- [x] 1.4 In the guide, provide a minimally-scoped permissions policy JSON covering exactly what `sam deploy` needs for `infra/template.yaml` (CloudFormation, Lambda, API Gateway v2, DynamoDB, IAM role management for the Lambda execution roles, S3 access to the SAM managed artifacts bucket)
- [x] 1.5 Follow the guide to actually create the OIDC provider and IAM Role in the AWS account hosting `poker-planning-dev`
- [x] 1.6 Record the resulting Role ARN as a GitHub Actions repository variable (e.g. `AWS_DEPLOY_ROLE_ARN`)

## 2. Workflow implementation

- [x] 2.1 Create `.github/workflows/deploy-backend.yml` with `push: branches: [master]` + `paths` filter on `apps/realtime-api/**`, `packages/shared-contracts/**`, `infra/**`, plus `workflow_dispatch`
- [x] 2.2 Add `permissions: id-token: write, contents: read` (required for OIDC token requests)
- [x] 2.3 Add steps: checkout, setup Node, `npm ci`, `aws-actions/configure-aws-credentials` using `role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}` and `aws-region: us-east-2`
- [x] 2.4 Add steps to install/set up AWS SAM CLI in the runner
- [x] 2.5 Add `sam build` step (working directory `infra/`)
- [x] 2.6 Add `sam deploy --no-confirm-changeset --no-fail-on-empty-changeset` step using the existing `infra/samconfig.toml` settings

## 3. Verification

- [ ] 3.1 Trigger the workflow manually via `workflow_dispatch` and confirm it authenticates via OIDC (no static keys) and completes `sam deploy` successfully
- [ ] 3.2 Confirm the deployed stack (`poker-planning-dev`) is unchanged in behavior — WebSocket URL stable, existing rooms/table unaffected
- [ ] 3.3 Make a trivial change under `packages/shared-contracts/` on a branch, merge to `master`, and confirm the workflow triggers automatically and deploys
- [ ] 3.4 Confirm a `master` push touching only `apps/web/**` does NOT trigger the backend workflow

## 4. Documentation

- [x] 4.1 Update `docs/local-dev-workflow.md` (or equivalent) to note that backend deploys to production now happen automatically on push to `master`, and manual `sam deploy` is only needed for local/dev stacks or as a fallback
- [x] 4.2 Cross-link `docs/aws-oidc-setup.md` from the main README or docs index if one exists
