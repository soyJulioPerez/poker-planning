## Context

Today the repo has two deploy paths with very different levels of automation:

| | Frontend (`web`) | Backend (`realtime-api`) |
|---|---|---|
| Trigger | push to `master` (automatic) | `sam deploy` run by hand |
| Auth | none needed (GitHub Pages via `actions/deploy-pages`, uses GitHub's own OIDC internally) | AWS credentials on the maintainer's machine |
| Target | GitHub Pages | Lambda + API Gateway v2 + DynamoDB via CloudFormation (through SAM) |
| Workflow file | `.github/workflows/deploy-web.yml` | none |

This asymmetry already caused a real incident: after `packages/shared-contracts` gained new emoji icons, the frontend went live immediately (automatic deploy) but the backend's server-side validation (`iconGroup.icons.includes(...)` in `join-room.ts` / `create-room.ts`) still had the old catalog until someone remembered to run `sam deploy` manually — so picking a new icon silently failed. Automating the backend deploy the same way the frontend already is closes that gap structurally, not just by remembering harder next time.

`infra/template.yaml` (SAM/CloudFormation) already defines every AWS resource: `RoomsTable` (DynamoDB), `WebSocketApi` + routes (API Gateway v2), and three Lambda functions (`Connect`, `Disconnect`, `Default`) built via esbuild from `apps/realtime-api/src/handlers/*.ts`. `infra/samconfig.toml` pins `stack_name`, `region = us-east-2`, and deploy flags. None of that needs to change — only *who/what* runs `sam build && sam deploy` changes.

## Goals / Non-Goals

**Goals:**
- `sam build && sam deploy` runs automatically in CI whenever `apps/realtime-api/**` or `packages/shared-contracts/**` change on `master`.
- CI authenticates to AWS without storing long-lived secrets in GitHub.
- A maintainer without prior OIDC experience can follow the setup guide and understand *why* each step exists, not just execute it blindly.
- Manual deploy remains possible as a fallback (`workflow_dispatch`, or still running `sam deploy` locally if someone has credentials).

**Non-Goals:**
- Creating the AWS-side OIDC provider and IAM Role via CI or as CloudFormation-managed resources in `template.yaml` itself — this is a deliberate one-time bootstrap step done outside CI (see Risks below for why).
- Multi-environment / multi-stage deploys (staging vs prod). The project has a single `poker-planning-dev` stack; this change does not introduce environment promotion.
- Changing anything about how the frontend discovers the backend URL (`environment.aws.ts` stays as-is; the WebSocket URL doesn't change since `sam deploy` updates the same stack in place).

## Decisions

### Decision 1: OIDC + IAM Role instead of static AWS access keys

**What OIDC federation actually does here:**

Normally, a program authenticates to AWS by presenting a long-lived Access Key ID + Secret Access Key — essentially a password that's valid until someone rotates or revokes it. If that pair leaks (committed to a repo, printed in a log, exfiltrated from a compromised CI runner), it's usable by anyone, from anywhere, until manually revoked.

OIDC (OpenID Connect) federation replaces that shared secret with a **trust relationship** plus **short-lived tokens**:

1. GitHub Actions itself runs an OIDC identity provider at `token.actions.githubusercontent.com`. Every workflow run can request a signed JSON Web Token (JWT) from GitHub asserting facts like "this token was issued for a workflow run in repo `soyJulioPerez/poker-planning`, on branch `master`, for workflow file `deploy-backend.yml`." GitHub signs this token with its own private key.
2. AWS IAM is told, once, to **trust** that identity provider: "tokens signed by `token.actions.githubusercontent.com` are acceptable for authentication, *if* the token's claims match this exact repo." This is the IAM OIDC Identity Provider resource plus an IAM Role with a trust policy containing a `StringLike`/`StringEquals` condition on the token's `sub` (subject) claim, e.g. `repo:soyJulioPerez/poker-planning:*`.
3. At runtime, the `aws-actions/configure-aws-credentials` GitHub Action requests that JWT from GitHub, then calls AWS STS's `AssumeRoleWithWebIdentity` API, presenting the JWT. STS verifies the JWT's signature against GitHub's published public keys, checks the claims against the role's trust policy, and — if they match — issues **temporary AWS credentials** (Access Key + Secret + Session Token) valid for typically 1 hour.
4. Those temporary credentials are what `sam deploy` actually uses. They expire automatically; there is nothing to rotate, and nothing persists in GitHub as a secret that could leak from a repo settings page or a misconfigured log.

This is the same trust-federation pattern used for SSO everywhere (SAML/OIDC): instead of every relying party storing a password, they all trust a common identity provider's *signed assertions*, scoped down by conditions on the assertion's claims.

**Why this over static keys:** static `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` GitHub Secrets would work and are simpler to wire up (paste two values, done) — but they're long-lived, don't expire on their own, and a leak (e.g., accidentally printed in a build log, or a compromised Actions runner) is a standing risk until someone notices and rotates them. Given this project already treats "a human has to remember to do X" as the root cause of the icon-catalog incident, introducing a new "a human has to remember to rotate/revoke Y" isn't a good trade.

**Alternative considered:** GitHub's OIDC could also target an AWS SSO / Identity Center permission set instead of a plain IAM Role. Rejected as unnecessary complexity — this is a single-account, single-stack project; a scoped IAM Role is the minimal mechanism that solves the problem.

### Decision 2: The IAM Role/OIDC provider is bootstrapped manually, once, outside CI

The workflow that deploys the backend needs the IAM Role to already exist in order to authenticate — it cannot create its own trust anchor (the role it would need to create *that* role doesn't exist yet either). So provisioning the OIDC provider + role is inherently a one-time, out-of-band step.

**Options considered:**
- *Manual via AWS Console/CLI, documented in a guide* — chosen. Simplest to reason about for a single-developer project, and matches how `infra/template.yaml` itself is currently deployed by hand today (this change doesn't need to introduce a second meta-deployment pipeline just to bootstrap the first one).
- *A separate bootstrap CloudFormation template* — more "infrastructure as code" purity, but adds a second stack to maintain and still requires a human to deploy it manually the first time with sufficient IAM privileges (`iam:CreateRole`, `iam:CreateOpenIDConnectProvider` aren't things a fresh CI runner can grant itself). Deferred as unnecessary ceremony for a single IAM role; documented as a possible future improvement instead.

**Scope of the Role's permissions:** scoped to exactly what `sam deploy` needs for `infra/template.yaml`'s resources — CloudFormation stack operations, Lambda function create/update, API Gateway v2 management, DynamoDB table management (already-existing table, so mostly no-op unless schema changes), IAM role creation/attachment for the three Lambda execution roles (SAM creates one per function), and S3 access to the `sam deploy` managed artifacts bucket. Broad `AdministratorAccess` is deliberately avoided — the blast radius of a compromised CI run should be limited to this stack's resources.

### Decision 3: Path-filtered trigger, separate workflow file

`deploy-backend.yml` is a new, independent file (not a job added to `deploy-web.yml`), triggered by `push: branches: [master]` with `paths: ['apps/realtime-api/**', 'packages/shared-contracts/**', 'infra/**']`. This keeps the two deploy pipelines decoupled (frontend-only changes never invoke AWS credentials at all) and mirrors the existing separation of concerns — `deploy-web.yml` stays untouched.

`workflow_dispatch` is also enabled as a manual fallback trigger (e.g., to force a redeploy without a code change, or to recover if a scheduled path-filtered run was skipped for an unrelated reason).

## Risks / Trade-offs

- **[Risk]** The one-time manual IAM bootstrap step is easy to get wrong (overly broad trust condition, overly broad permissions) since it's done by hand outside any reviewed pipeline. → **Mitigation**: the setup guide (`docs/aws-oidc-setup.md`) gives copy-pasteable, minimally-scoped policy JSON rather than "figure out the right permissions," and explains the trust condition's `sub` claim precisely so it isn't loosened to `repo:soyJulioPerez/*` "just in case."
- **[Risk]** If the IAM Role's permissions are too narrow, `sam deploy` fails partway through a stack update, potentially leaving CloudFormation in `UPDATE_ROLLBACK_FAILED`. → **Mitigation**: this is a pre-existing risk of using `sam deploy` at all (identical risk exists today when run from a human's machine); not introduced by this change. Documented in the guide as "if a deploy fails, check the CloudFormation console for stack status before retrying."
- **[Trade-off]** Automating the deploy means a bad merge to `master` that touches backend code now reaches production without a human explicitly choosing to run `sam deploy` at that moment (previously, the manual step was an implicit checkpoint). → Accepted: this mirrors how the frontend already deploys automatically on every `master` push, and the project has no separate staging environment to gate on. `workflow_dispatch` and the ability to revert via `git revert` remain available.
- **[Trade-off]** Debugging a failed OIDC `AssumeRoleWithWebIdentity` call (trust policy condition typo, wrong provider thumbprint, etc.) requires understanding AWS STS error messages, which are not always self-explanatory. → Mitigated by explaining the exact claim structure (`sub`, `aud`) in the setup guide so a maintainer can compare it against the actual error.

## Migration Plan

1. Follow `docs/aws-oidc-setup.md` to create the IAM OIDC Identity Provider and IAM Role in the AWS account that already hosts `poker-planning-dev` (one-time, manual, outside CI).
2. Add the resulting Role ARN as a GitHub Actions variable (not a secret — Role ARNs aren't sensitive) or repository secret, referenced by `deploy-backend.yml`.
3. Add `.github/workflows/deploy-backend.yml`.
4. Verify with a manual `workflow_dispatch` run before relying on the automatic path-filtered trigger, to confirm the role's permissions are sufficient without waiting for an organic backend change.
5. Rollback: deleting or disabling the workflow file reverts to the pre-existing manual `sam deploy` process; the IAM Role can be left in place harmlessly (it grants no access unless a matching OIDC token is presented) or deleted if fully rolling back.

## Open Questions

- Exact AWS account ID and whether the IAM Role should be named something specific for consistency with any existing naming convention — left for the setup guide to fill in with the actual account details at bootstrap time, since this design doc shouldn't hardcode account-specific identifiers.
