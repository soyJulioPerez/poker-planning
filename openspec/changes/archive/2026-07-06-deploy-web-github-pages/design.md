## Context

`web` is an Angular 21 app built with `@angular/build:application` (esbuild-based), output to `dist/apps/web`. It's served today only via `nx serve web` locally. It talks to a WebSocket backend already deployed at a fixed AWS API Gateway URL (`apps/web/src/app/core/room-socket.service.ts`) — no backend changes needed here.

GitHub Pages serves static files only: no server-side rewrites, no custom response headers per route. The repo will be `poker-planning`, so without a custom domain the site is served at `https://<user>.github.io/poker-planning/` — a non-root subpath.

## Goals / Non-Goals

**Goals:**
- Publish `web` as a static site on GitHub Pages, auto-deployed on push to `main`.
- App works correctly at the `/poker-planning/` subpath: assets load, routing works, direct loads/refreshes of `/room/:roomId` don't 404.
- Zero backend changes.

**Non-Goals:**
- Custom domain setup (can be added later; out of scope).
- Deploying `realtime-api` or touching AWS infra.
- CI for tests/lint as part of this workflow (build-only for deploy; existing test/lint tasks are untouched).

## Decisions

- **Build command**: `nx build web` (production configuration, already the default). Output at `dist/apps/web/browser` (Angular application builder emits a `browser/` subfolder for browser output).
- **Base href for subpath**: Use `ng build --base-href /poker-planning/` equivalent via Nx — pass `--base-href=/poker-planning/` as a CLI override in the workflow step, rather than hardcoding it in `apps/web/src/index.html` or `project.json`. This keeps local dev (`nx serve`, `nx build`) working at root `/` unchanged, and only the deploy workflow injects the Pages-specific base href.
- **SPA fallback**: After build, copy `index.html` to `404.html` in the output folder before publishing. GitHub Pages serves `404.html` for any unmatched path, which loads the Angular app and lets the Angular Router take over and resolve `/room/:roomId` client-side.
- **Deployment mechanism**: Use GitHub's official Pages Actions (`actions/upload-pages-artifact` + `actions/deploy-pages`) rather than pushing to a `gh-pages` branch. This is the modern, recommended approach — no extra branch, uses the repo's built-in Pages environment/permissions.
- **Trigger**: `on: push: branches: [master]` plus `workflow_dispatch` for manual re-deploys.

## Risks / Trade-offs

- [Repo isn't public yet / GitHub Pages not enabled] → Mitigation: document the one-time manual step (Settings → Pages → Source: GitHub Actions) in tasks; workflow alone can't enable Pages on a repo where it's never been turned on.
- [Base href mismatch causes broken asset paths if repo is later renamed] → Mitigation: base-href is passed as a single workflow parameter, easy to update if the repo name changes.
- [`404.html` trick means real 404s (e.g. typo'd room codes) render the app shell instead of a genuine 404 status] → Accepted trade-off, standard for SPA-on-Pages; the app's own routing/UI handles unknown rooms as needed (existing `joinRejected`/`room-not-found` handling in `room-socket.service.ts`).
- [Mixed content / CORS] → Not a concern: WebSocket URL is already `wss://`, matching the `https://` Pages origin.

## Migration Plan

1. Add workflow `.github/workflows/deploy-web.yml` building with the subpath base-href and generating `404.html`.
2. Push to `master`; verify the Pages deployment succeeds and the site loads at the expected URL.
3. One-time manual step: enable GitHub Pages for the repo with source "GitHub Actions" (Settings → Pages).
4. Rollback: disabling the workflow or reverting the commit stops future deploys; GitHub Pages keeps serving the last successful deployment until a new one is enabled/pushed.

## Open Questions

- None blocking. Custom domain and CI-gating (only deploy if tests pass) can be follow-ups.
