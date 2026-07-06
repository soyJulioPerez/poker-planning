## 1. Workflow setup

- [x] 1.1 Create `.github/workflows/deploy-web.yml` triggered on `push` to `master` and `workflow_dispatch`
- [x] 1.2 Add job steps: checkout, setup Node, install deps (`npm ci`), run `nx build web` with `--base-href=/poker-planning/`
- [x] 1.3 Add step to copy `dist/apps/web/browser/index.html` to `dist/apps/web/browser/404.html`
- [x] 1.4 Add `actions/upload-pages-artifact` step pointing at `dist/apps/web/browser`
- [x] 1.5 Add `deploy` job using `actions/deploy-pages` with correct `permissions` (`pages: write`, `id-token: write`) and `environment: github-pages`

## 2. Repository configuration

- [x] 2.1 Enable GitHub Pages in repo Settings → Pages, Source: "GitHub Actions" (manual, one-time)
- [x] 2.2 Confirm repo name is `poker-planning` (or update base-href in workflow if different)

## 3. Verification

- [x] 3.1 Push to `master`, confirm workflow run succeeds
- [x] 3.2 Load `https://<user>.github.io/poker-planning/` and confirm the app renders with no broken asset requests
- [x] 3.3 Create a room, copy its URL, open it directly in a new tab/refresh to confirm `404.html` fallback correctly loads the room route — confirmed via `curl`: GitHub Pages serves the `404.html` shell (same etag as `index.html`, correct `base href`) for `/room/:roomId`, so the deploy-side fallback works as designed. Refreshing an existing tab also works end-to-end. Opening the link in a brand-new tab gets stuck on "Conectando a la sala..." — this is a pre-existing app bug (no session in `sessionStorage` → `rejoinIfNeeded` never connects, and there's no join form for a fresh direct link), unrelated to the GitHub Pages deployment. Tracked separately in `openspec/known-issues.md`.
- [x] 3.4 Confirm WebSocket connects (room join/estimation flow works end-to-end) against the existing production `realtime-api` — confirmed working for the normal flow (create/join room from the home page, refresh within the same tab). See note on 3.3 for the direct-link edge case.
