# Known Issues

## Direct room link in a new tab/browser never connects

**Found:** 2026-07-06, while verifying the `deploy-web-github-pages` change.

**Symptom:** Pasting a room URL (e.g. `/room/U9DG8K`) into a brand-new tab (or a browser/session with no prior state for that room) gets stuck on "Conectando a la sala..." forever. Refreshing an *existing* tab that already joined the room works fine.

**Root cause:** `RoomSocketService.rejoinIfNeeded` (`apps/web/src/app/core/room-socket.service.ts`) only reconnects if there's a matching session in `sessionStorage`:

```ts
rejoinIfNeeded(roomId: string): void {
  if (this.room()) return;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return; // no-op: never connects, never shows a join form
  ...
}
```

`sessionStorage` is per-tab and never populated until a user actually submits a name via the home page join flow. A freshly opened tab (someone clicking a shared link) has no session, so `rejoinIfNeeded` silently does nothing — no connection attempt, no fallback UI to prompt for a name.

**Not related to:** the GitHub Pages deployment or the `404.html` SPA fallback — both work correctly (verified via `curl`, matching `etag`/content to `index.html`, correct `base href`). This is pre-existing app behavior, reproducible in local dev too.

**Suggested fix (future change):** When `room()` is null and there's no valid session for `roomId`, show a "join this room" form (name input) instead of leaving the user on the loading state indefinitely.
