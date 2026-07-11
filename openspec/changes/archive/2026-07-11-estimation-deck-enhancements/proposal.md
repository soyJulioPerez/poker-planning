## Why

El backlog de ideas (`docs/future-ideas.md`, categoría "Mazos y valores de estimación") propone enriquecer el catálogo de mazos con variantes visuales (emojis) y un símbolo de pausa alternativo ("mate"), para que la sesión de estimación resulte más expresiva y cercana al equipo, sin cambiar la mecánica de votación/resolución ya existente.

## What Changes

- Se agrega la carta 🧉 ("mate") como símbolo de pausa adicional en **todos** los mazos existentes (`Fibonacci`, `Powers of 2`, `T-Shirt Sizes`), conviviendo con ☕ y "?" sin reemplazarlos.
- Se agrega un nuevo mazo **"T-Shirt con iconos"**, paralelo a `TSHIRT_DECK`: cada talla combina el emoji de una persona de distinta edad con la sigla existente (ej. "🍼 XS", "🧒 S", "🧑‍🦱 M", "🧑 L", "🧔 XL", "👴 XXL").
- Se agrega un nuevo mazo **"Fibonacci con manos"**, paralelo a `FIBONACCI_DECK`: cada valor numérico combina una descomposición fija de emojis de manos/pies con el número (ej. "✋☝ 6", "✊ 0"), manteniendo "?"/"☕"/"🧉" sin decoración.
- No se modifica ninguna regla de votación, revelado, cálculo de promedio/moda o resolución de historia: los valores nuevos son strings de mazo como cualquier otro, y la lógica existente que excluye no-numéricos del promedio y del click-to-resolve ya cubre "?", "☕" y "🧉" sin cambios adicionales.

## Capabilities

### New Capabilities
(ninguna — este cambio extiende el catálogo estático de mazos, no introduce comportamiento nuevo)

### Modified Capabilities
- `estimation-session`: el requirement "Selección de mazo de estimación" se amplía para reflejar que el catálogo de mazos predefinidos incluye variantes con emojis y que todos los mazos comparten los mismos símbolos de pausa (☕ y 🧉).

## Impact

- `packages/shared-contracts/src/lib/decks.ts`: agrega 🧉 a los mazos existentes, define `HAND_FIBONACCI_DECK` y `TSHIRT_WITH_ICONS_DECK`, los suma a `AVAILABLE_DECKS`.
- `packages/shared-contracts/src/lib/decks.spec.ts`: cobertura para los nuevos mazos.
- Ningún cambio en `apps/realtime-api` (los mazos son catálogo estático consumido por el cliente; el servidor solo guarda/propaga `deckId` y valores de voto como strings, sin lógica específica por mazo).
- `apps/web`: sin cambios de código — `VotingBoard`/`Card` ya renderizan cualquier string de `deck.values` tal cual, y el selector de mazo en `Home` ya itera `AVAILABLE_DECKS` dinámicamente.
