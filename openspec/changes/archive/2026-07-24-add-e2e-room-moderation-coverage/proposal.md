## Why

`add-e2e-estimation-rules-coverage` (ya archivado) cerró la brecha de cobertura e2e sobre las invariantes de `estimation-session`. La capability `room-management` (`openspec/specs/room-management/spec.md`) tiene una brecha equivalente: reglas que el servidor rechaza explícitamente (nombre duplicado al unirse, acciones de moderación ejecutadas por un no-moderador) y comportamiento de estado en tiempo real (reconexión automática, estado "desconectado", el toggle de "moderador vota") que hoy solo se verifican leyendo el código — ningún test detectaría una regresión en ellas.

## What Changes

- Se agrega `e2e/room-moderation.spec.ts`, un nuevo spec de Playwright que reutiliza la capa de Page Objects/fixtures ya existente (`e2e/pages/home.page.ts`, `e2e/pages/room.page.ts`, `e2e/fixtures.ts`, introducida por `add-e2e-estimation-rules-coverage`) sin modificarla, cubriendo:
  - Nombre duplicado rechazado al unirse a una sala (mientras el participante original sigue conectado).
  - Un participante no-moderador no ve disponibles las acciones de moderación (revelar, resolver, nueva ronda).
  - El moderador puede activar "quiero votar" entre rondas (`roundPhase` inactivo).
  - El control de "moderador vota" queda deshabilitado mientras hay una ronda de votación activa.
  - Reconexión automática: un participante que pierde la conexión y vuelve a unirse con el mismo nombre a la misma sala recupera su voto y posición, sin duplicarse en la lista.
  - Un participante desconectado se marca visualmente como "desconectado" y permanece en la lista de participantes (no se elimina).
- Puede requerir extender `e2e/pages/room.page.ts` con métodos/getters nuevos (ej. localizar el toggle de "moderador vota", el estado "desconectado" de un ítem de la lista) — extensión de la capa existente, no una capa nueva.
- No se modifica infraestructura de configuración de Playwright (`playwright.config.mts`, `project.json`, scripts npm) ni el comportamiento de la aplicación — son tests nuevos sobre comportamiento ya implementado.

## Capabilities

### New Capabilities
(ninguna — este cambio es infraestructura de testing, sin comportamiento observable de la aplicación)

### Modified Capabilities
(ninguna — no se toca ningún requirement de dominio bajo `openspec/specs/`; los tests verifican requirements ya existentes de `room-management`)

## Impact

- Nuevo archivo `e2e/room-moderation.spec.ts`.
- Posibles adiciones (no reescrituras) a `e2e/pages/room.page.ts` para soportar los casos de reconexión/desconexión/toggle de moderador.
- Sin cambios a `e2e/playwright.config.mts`, `e2e/project.json` ni a los scripts npm (`test:e2e`, `test:e2e:aws`) ya existentes.
- No afecta `apps/web` ni `apps/realtime-api` — no se espera ningún cambio de código de aplicación; si algún caso revela una discrepancia con el spec, se documenta como hallazgo y se resuelve como un change aparte (mismo criterio que `add-e2e-estimation-rules-coverage`).
- Depende de `add-e2e-estimation-rules-coverage` (ya archivado) para la capa de Page Objects/fixtures reutilizada.
