## Why

`apps/web` tiene 15 archivos fuente con lógica real y solo 3 specs (uno de ellos el scaffold genérico de Nx). El hueco concreto: `home.ts` y `room.ts` tienen el flujo que resuelve el bug ya documentado ("Link directo a una sala en pestaña nueva nunca conecta" — corregido, verificado en vivo, pero sin ningún test que lo asiente) y `BrowserSessionStore` (la implementación real de `sessionStorage`) no tiene test. Sin cobertura ahí, ese arreglo puede romperse una segunda vez tan silenciosamente como se arregló la primera.

## What Changes

- Test de regresión en `home.ts`/`room.ts` para el flujo: sala sin sesión guardada → redirect a `/` con `?room=<código>` → formulario de "unirse" precargado.
- Test unitario de `BrowserSessionStore` (`apps/web/src/app/core/room-session-store.ts`).
- Umbral de cobertura propio para `apps/web`, configurado nativo en el executor `@angular/build:unit-test` (`coverage`, `coverageThresholds`), fijado en el valor ya alcanzado por la suite al momento de establecerlo — mismo criterio de trinquete que ya usa `apps/realtime-api`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `continuous-integration`: se agrega un requirement análogo al que ya existe para `apps/realtime-api` ("La cobertura de tests no baja del umbral ya alcanzado"), pero scopeado a `apps/web` — es una tarea de test y un umbral separados (Vitest vía `@angular/build:unit-test`, no Jest), así que necesita su propio requirement, no una extensión del existente.

## Impact

- `apps/web/src/app/pages/home/home.spec.ts` (nuevo)
- `apps/web/src/app/pages/room/room.spec.ts` (nuevo)
- `apps/web/src/app/core/room-session-store.spec.ts` (nuevo)
- `apps/web/project.json`: target `test` gana `coverage`/`coverageThresholds`
- `docs/hardening-roadmap.md`: cierre de la Fase 2.4
- Fuera de alcance: `room-client-runtime` (ya tiene cobertura real; no se toca salvo que aparezca un gap concreto al escribir los tests de arriba)
