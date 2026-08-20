## 1. Escala implícita en el cálculo de promedio

- [x] 1.1 `apps/realtime-api/src/lib/reveal-result.ts`: cambiar `computeRevealResult(votes, numericValues?)` a `computeRevealResult(votes, deck?)`, recibiendo el `DeckOption` completo. Calcular la escala como `deck.numericValues ? Object.values(deck.numericValues) : deck.values.map(Number).filter(Number.isFinite)`, y aplicar el ajuste al valor más cercano siempre que la escala tenga al menos un valor (no solo cuando `numericValues` existe).
- [x] 1.2 `apps/realtime-api/src/actions/reveal.ts`: pasar el `deck` completo a `computeRevealResult` en vez de `deck?.numericValues`.
- [x] 1.3 `apps/realtime-api/src/lib/reveal-result.spec.ts`: agregada cobertura para la escala implícita (Fibonacci) — nuevo test `{ana:'3',beto:'5'}` con `FIBONACCI_DECK` espera `3` (antes hubiera dado `4` crudo). El test original sin mazo (`{ana:'3',beto:'5',caro:'?'}` → `4`) se dejó intacto: sin `deck`, sigue sin haber escala contra la cual ajustar — es un caso distinto (fallback defensivo, no el camino real de `reveal.ts`), documentado con un test propio ("sin mazo, no hay escala"). También se actualizó `reveal.spec.ts` (no estaba en el plan original): su camino feliz votaba 5+5+8=6 crudo en un mazo Fibonacci, que no es una carta válida — ahora ajusta a 5.

## 2. Link compartible en fila propia

- [x] 2.1 `apps/web/src/app/pages/room/room.html`: mover `<p class="room__share">` fuera de la mitad izquierda de `.room__header`, a una fila propia de ancho completo.
- [x] 2.2 `apps/web/src/app/pages/room/room.scss`: ajustar `.room__header`/`.room__share` para el nuevo layout (el header ya no necesita acomodar el link en su columna izquierda).

## 3. Verificación

- [x] 3.1 `nx affected -t lint test build` sobre los proyectos afectados (`realtime-api`, `web`, `e2e`) — verde, sin regresión de cobertura.
- [x] 3.2 Verificación manual en el navegador (stack local): sala Fibonacci `ZRXH8V`, votos 3 y 5 (promedio crudo 4, no es carta) → "Aceptar promedio (3)", confirmado. Link compartible en una sola fila, ancho completo — confirmado con screenshot.
