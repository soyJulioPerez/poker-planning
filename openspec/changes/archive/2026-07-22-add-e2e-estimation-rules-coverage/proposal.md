## Why

La suite e2e (`e2e/estimation-flow.spec.ts`, agregada por `add-e2e-playwright-tests`) cubre hoy un único camino feliz: crear sala, votar, revelar y aceptar el promedio. Ese change fue explícito en dejar el resto como no-goal ("se prioriza el flujo principal; ampliar cobertura queda como trabajo futuro"). La capability `estimation-session` (`openspec/specs/estimation-session/spec.md`) define varias invariantes que el servidor rechaza explícitamente (votar o revelar sin historia asignada, resolver con un valor no numérico) y reglas de cálculo no triviales (moda empatada, mazos con escala numérica interna como "T-Shirt Sizes", redondeo del promedio a la talla más cercana) que hoy solo se verifican leyendo el código — ningún test detectaría una regresión en ellas.

## What Changes

- Se agrega `e2e/estimation-rules.spec.ts`, un nuevo spec de Playwright (sin tocar `playwright.config.mts` ni la orquestación existente) que cubre los siguientes casos de `estimation-session`:
  - Intento de revelar votos sin historia asignada — rechazado en la UI (botón no disponible).
  - Intento de votar sin historia asignada — rechazado en la UI (mazo no disponible).
  - Moda empatada tras revelar (dos valores con igual frecuencia) — se muestra como texto informativo, sin botón "Aceptar moda".
  - Moda con único valor no numérico y sin escala interna (ej. "☕") — mismo comportamiento: sin botón de aceptar.
  - Nueva ronda descarta los votos previos de la historia actual.
  - Resolución de la historia seleccionando el voto numérico de un participante puntual (no promedio ni moda).
  - Mazo "T-Shirt Sizes": aceptar la moda asigna el número interno de la talla (no la talla como texto).
  - Mazo "T-Shirt Sizes": el botón de aceptar promedio muestra la talla más cercana al promedio interno (redondeo por distancia lineal) y asigna su número interno al aceptar.
- Se introduce una capa de Page Objects (`e2e/pages/home.page.ts`, `e2e/pages/room.page.ts`) y fixtures de Playwright (`e2e/fixtures.ts`) para encapsular las interacciones repetidas (crear sala, unirse, definir historia, votar, revelar). `e2e/estimation-flow.spec.ts` (existente) se migra a usar esta capa — refactor de test sin cambiar aserciones ni comportamiento verificado.
- No se modifica infraestructura de configuración de Playwright (config, scripts npm, orquestación local/AWS) ni el comportamiento de la aplicación — son tests nuevos y un refactor de test sobre comportamiento ya implementado.

## Capabilities

### New Capabilities
(ninguna — este cambio es infraestructura de testing, sin comportamiento observable de la aplicación)

### Modified Capabilities
(ninguna — no se toca ningún requirement de dominio bajo `openspec/specs/`; los tests verifican requirements ya existentes de `estimation-session`)

## Impact

- Nuevos archivos: `e2e/estimation-rules.spec.ts`, `e2e/pages/home.page.ts`, `e2e/pages/room.page.ts`, `e2e/fixtures.ts`.
- `e2e/estimation-flow.spec.ts` se modifica (refactor, mismas aserciones) para usar los Page Objects/fixtures nuevos.
- Sin cambios a `e2e/playwright.config.mts`, `e2e/project.json` ni a los scripts npm (`test:e2e`, `test:e2e:aws`) ya existentes.
- No afecta `apps/web` ni `apps/realtime-api` — no se espera ningún cambio de código de aplicación; si algún caso revela una discrepancia con el spec, se documenta como hallazgo y se resuelve como un change aparte.
- Depende de `add-e2e-playwright-tests` (ya archivado) para la infraestructura base (proyecto Nx `e2e`, `E2E_TARGET`, Angular environments).
