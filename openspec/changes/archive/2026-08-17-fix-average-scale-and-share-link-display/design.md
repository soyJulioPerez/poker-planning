## Context

Dos fixes acotados, sin ambigüedad de diseño pendiente. Se documentan las decisiones técnicas puntuales de cada uno.

## Goals / Non-Goals

**Goals:**
- El promedio mostrado (y aceptable como puntuación final) siempre es un valor que existe en el mazo de la sala, sin importar si ese mazo tiene una escala numérica explícita o no.
- El link compartible deja de cortarse en dos líneas por falta de espacio horizontal.

**Non-Goals:**
- No se toca el criterio de desempate por distancia ("ante un empate, gana el valor menor") — ya existe para T-Shirt, se reutiliza tal cual.
- No se agrega manejo de overflow/ellipsis para el link — la causa era falta de ancho, no falta de wrap-handling; darle una fila propia la resuelve de raíz.

## Decisions

### 1. Escala implícita para mazos sin `numericValues`

`computeRevealResult` (`apps/realtime-api/src/lib/reveal-result.ts`) hoy recibe `numericValues?: Record<string, number>` como único parámetro opcional, y solo ajusta el promedio a la escala más cercana cuando ese parámetro existe. Pasa a recibir el `DeckOption` completo (`values` + `numericValues` opcional) en vez de solo `numericValues` — `reveal.ts` ya tiene el `deck` completo disponible (`AVAILABLE_DECKS.find(...)`), simplemente no lo pasaba entero.

La escala para el ajuste se calcula así:
```
scale = deck.numericValues
  ? Object.values(deck.numericValues)          // explícita (T-Shirt)
  : deck.values.map(Number).filter(Number.isFinite)  // implícita (Fibonacci, Powers of 2)
```
El ajuste al valor más cercano de `scale` se aplica siempre que `scale.length > 0`, no solo cuando hay `numericValues` explícito. Sin mazo (`deck` undefined) o sin ningún valor numérico parseable, no hay ajuste — mismo comportamiento de fallback que existe hoy.

**Consecuencia esperada, no un efecto secundario**: con votos `3` y `5` en Fibonacci, el promedio crudo es `4` — que no es una carta Fibonacci válida. Antes: se mostraba "4" tal cual. Después: `4` empata a distancia 1 de `3` y de `5`; por la regla de desempate ya existente (gana el valor menor), el promedio pasa a ser `3`. Es exactamente el caso que la escala Fibonacci existe para evitar — un valor intermedio nunca fue una opción real. El test existente que hoy espera `4` para ese caso se actualiza a `3`, documentando el cambio de comportamiento a propósito.

### 2. Link compartible en su propia fila

`room.html` mueve el `<p class="room__share">` fuera de la mitad izquierda de `.room__header` (hoy comparte fila con las estadísticas vía `flex space-between`), a una fila propia de ancho completo dentro de `.room` (`max-width: 40rem`). El header conserva el título y las estadísticas/botón de cerrar; el link pasa a estar debajo, con todo el ancho de la tarjeta disponible.

## Risks / Trade-offs

- **[Riesgo] El cambio de escala modifica un resultado ya calculado y mostrado en producción para mazos Fibonacci/Powers of 2.** → Mitigación: es un cambio de presentación de un valor derivado (el promedio), no de datos persistidos de forma irreversible fuera de `resolvedStories` — una historia ya resuelta con un promedio crudo aceptado antes de este cambio no se recalcula retroactivamente, solo cambia el comportamiento para rondas futuras.
- **[Riesgo] Con una URL muy larga en una pantalla muy angosta (mobile chico), podría seguir wrappeando incluso con fila propia.** → Aceptado: el objetivo es eliminar el corte por compartir la mitad de una fila con las estadísticas, no garantizar una sola línea en cualquier ancho de pantalla — eso excede el alcance de este fix.
