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

## E2E test flaky: "participante desconectado se marca como desconectado sin salir de la lista"

**Found:** 2026-08-01, mientras se verificaba el change `uncouple-client-logic`.

**Síntoma:** `e2e/room-moderation.spec.ts:158` falla intermitentemente (~2 de cada 3 corridas en runs aislados de este test con `--workers=1`), casi siempre en `waitForRoomUrl` justo después de `moderatorHome.createRoom(...)` (timeout de 10s esperando la navegación a `/room/...`), aunque en al menos una corrida falló más adelante, en la aserción del estado "desconectado".

**Confirmado no relacionado con `uncouple-client-logic`:** se hizo `git stash` de todos los cambios de ese refactor (vuelta al `RoomSocketService` original basado en `signal()`/`sessionStorage` directo) y se corrió el mismo test 5 veces seguidas contra el código original — **falló las 5 veces**, en el mismo punto exacto (`waitForRoomUrl` tras `createRoom`). El resto de la suite (11/11 tests restantes) pasa consistentemente en ambas versiones del código.

**No investigado a fondo:** no se determinó la causa raíz. Hipótesis sin confirmar: el test abre un segundo `browser.newContext()` (proceso Chromium adicional) antes de que el moderador termine de crear la sala, lo que podría introducir contención de recursos o alguna condición de carrera con el WebSocket local de desarrollo.

**Sugerencia (futuro change):** investigar por separado; no bloquear changes no relacionados por este flake. Considerar aumentar el timeout de navegación en este test específico o reordenar la creación del segundo contexto para después de que el moderador ya esté en la sala, como primer paso de diagnóstico.
