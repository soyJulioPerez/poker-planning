## ADDED Requirements

### Requirement: Automated build and publish to GitHub Pages
The system SHALL automatically build the `web` app and publish it to GitHub Pages whenever changes are pushed to the `main` branch, and SHALL also support manual re-deployment on demand.

#### Scenario: Push to main triggers deployment
- **WHEN** a commit is pushed to `master`
- **THEN** a GitHub Actions workflow runs `nx build web` and publishes the build output to GitHub Pages

#### Scenario: Manual redeploy
- **WHEN** a maintainer triggers the workflow manually (workflow_dispatch)
- **THEN** the same build-and-publish process runs without requiring a new commit

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
