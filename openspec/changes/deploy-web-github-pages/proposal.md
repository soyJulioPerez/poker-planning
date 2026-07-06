## Why

The `web` app (Angular frontend) has no public hosting yet — it only runs locally via `nx serve web`. The realtime backend (`realtime-api`) is already deployed on AWS API Gateway/WebSocket, and the frontend already points to that production endpoint. Publishing the frontend to GitHub Pages gives the project a free, public URL without needing any backend hosting changes.

## What Changes

- Add a GitHub Actions workflow that builds `web` via `nx build web` and publishes `dist/apps/web/browser` to GitHub Pages on push to `master`.
- Configure the Angular build/deploy so the app works when served from `https://<user>.github.io/poker-planning/` (non-root subpath): correct `base href` and asset paths.
- Add a SPA fallback for GitHub Pages (which has no server-side rewrites), so deep links like `/room/:roomId` don't 404 on refresh/direct load. Standard approach: a `404.html` that's a copy of `index.html`.
- No changes to `realtime-api` or the WebSocket URL — backend stays as-is.

## Capabilities

### New Capabilities
- `web-static-deployment`: Building and publishing the Angular `web` app as a static site to GitHub Pages, including subpath base-href handling and SPA routing fallback.

### Modified Capabilities
(none — no existing spec's requirements change)

## Impact

- **Affected code**: `apps/web/project.json` (build configuration/base-href), possibly `apps/web/src/index.html`, new `.github/workflows/deploy-web.yml`.
- **Affected systems**: GitHub repository settings (Pages source = GitHub Actions).
- **Not affected**: `realtime-api`, AWS infra, WebSocket URL, other specs (`estimation-session`, `room-management`, `session-summary`).
