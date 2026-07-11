## Why

Se detectó que las sesiones con el mazo "T-Shirt Sizes" (y su variante "T-Shirt con iconos") nunca pudieron resolverse: el cálculo de promedio, el criterio de aceptación de moda, y el click-to-resolve sobre un voto individual todos exigen que el valor votado sea numérico (`Number.isFinite`), pero las siglas de talla (XS, S, M, L, XL, XXL) nunca lo son. Esto es una limitación preexistente del mazo T-Shirt, no introducida por cambios recientes, pero quedó expuesta al usarlo a fondo durante pruebas manuales.

## What Changes

- Se agrega `numericValues?: Record<string, number>` a `DeckOption`, un mapa opcional de valor de voto → número interno, usado únicamente para cálculo (promedio, moda, resolución), nunca para lo que se muestra al usuario.
- `TSHIRT_DECK` y `TSHIRT_WITH_ICONS_DECK` definen `numericValues` con escala de potencias de 2: `{ XS: 1, S: 2, M: 4, L: 8, XL: 16, XXL: 32 }`.
- El cálculo de `average` en el servidor (`reveal.ts`) usa `numericValues` del mazo de la sala (si existe) para convertir votos de talla a número antes de promediar; si no hay `numericValues` para el mazo, se comporta igual que hoy (`Number(value)` directo).
- El promedio resultante para mazos con `numericValues` se redondea a la talla más cercana en la escala (no se muestra como número crudo); para mazos sin `numericValues` (Fibonacci y variantes, Powers of 2), el comportamiento no cambia.
- La moda y el click-to-resolve sobre un voto individual también usan `numericValues` para determinar si un valor de talla es "resoluble", igual que ya ocurre con valores puramente numéricos.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `estimation-session`: el requirement "Cálculo de promedio y moda" y "Resolución manual de la historia" se amplían para cubrir mazos con valores no numéricos que tienen una escala numérica interna asociada (como T-Shirt Sizes).

## Impact

- `packages/shared-contracts/src/lib/domain.ts`: `DeckOption` gana `numericValues?: Record<string, number>`.
- `packages/shared-contracts/src/lib/decks.ts`: `TSHIRT_DECK` y `TSHIRT_WITH_ICONS_DECK` ganan `numericValues`.
- `apps/realtime-api/src/actions/reveal.ts`: `computeRevealResult` necesita el mazo de la sala (o su `numericValues`) para calcular promedio/moda correctamente; requiere pasar `deckId`/`numericValues` desde `handleReveal`.
- `apps/web/src/app/pages/room/room.ts` y `reveal-panel.ts`: `modeAsNumber`/`voteAsNumber` deben resolver contra `numericValues` del mazo actual, no solo `Number(valor)`.
