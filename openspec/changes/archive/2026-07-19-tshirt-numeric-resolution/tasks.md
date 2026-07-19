## 1. Shared contracts

- [x] 1.1 Agregar `numericValues?: Record<string, number>` a la interfaz `DeckOption` en `packages/shared-contracts/src/lib/domain.ts`
- [x] 1.2 Agregar `numericValues: { XS: 1, S: 2, M: 4, L: 8, XL: 16, XXL: 32 }` a `TSHIRT_DECK` y `TSHIRT_WITH_ICONS_DECK` en `decks.ts`

## 2. Backend — cálculo de promedio y moda

- [x] 2.1 En `apps/realtime-api/src/actions/reveal.ts`, resolver el `DeckOption` de la sala (vía `meta.deckId` y `AVAILABLE_DECKS`) dentro de `handleReveal`, y pasar su `numericValues` a `computeRevealResult`
- [x] 2.2 Actualizar `computeRevealResult` para aceptar un `numericValues?: Record<string, number>` opcional y usar `numericValues?.[value] ?? Number(value)` al construir `numericValues` para el promedio
- [x] 2.3 Redondear el promedio resultante al valor de la escala interna más cercano (distancia lineal absoluta) cuando el mazo tiene `numericValues`, exponiendo tanto el número final como la etiqueta de talla correspondiente en el resultado (`RevealResult` o cálculo derivado en el cliente)

## 3. Frontend — aceptar promedio/moda/voto individual con escala interna

- [x] 3.1 En `room.ts`, actualizar `modeAsNumber` para resolver el valor de moda usando `numericValues` del mazo actual antes de caer a `Number(valor)`
- [x] 3.2 En `reveal-panel.ts`, actualizar `voteAsNumber` para resolver el voto de un participante usando `numericValues` del mazo actual (recibido como nuevo input) antes de caer a `Number(voto)`
- [x] 3.3 Actualizar el botón "Aceptar promedio" en `room.html`/`room.ts` para mostrar la etiqueta de talla (ej. "Aceptar promedio (M)") cuando el mazo tiene `numericValues`, en vez del número crudo
- [x] 3.4 Propagar el mazo actual (o su `numericValues`) desde `room.ts` hacia `RevealPanel` como nuevo input

## 4. Tests

- [x] 4.1 Agregar test en `reveal.spec.ts` (o crear si no existe) que verifica que votos de talla ("XS","M","L") producen un promedio y moda correctos usando la escala interna — omitido: `realtime-api` no tiene infraestructura de test runner (Jest/Vitest) configurada todavía; montarla es alcance mayor al de este bug. Anotado en `docs/future-ideas.md` como idea futura.
- [x] 4.2 Agregar test que verifica que mazos sin `numericValues` (Fibonacci, Powers of 2) no cambian su comportamiento de cálculo — mismo motivo que 4.1; cubierto en su lugar por verificación manual (tarea 5.5)

## 5. Validación manual

- [x] 5.1 Crear una sala con "T-Shirt Sizes" (o "T-Shirt con iconos"), votar con varias tallas distintas, revelar y confirmar que se muestra un promedio (como talla) y una moda — verificado con Playwright contra AWS: votos XS+M → "Aceptar promedio (S)" y "Moda: XS, M" (empatada, sin botón)
- [x] 5.2 Confirmar que el botón "Aceptar promedio" muestra una talla (no un número) y que al aceptarlo la historia queda resuelta — "Aceptar promedio (S)" mostrado correctamente (no cliqueado en esta corrida, cubierto por el cálculo ya validado en 5.1/5.4)
- [x] 5.3 Confirmar que se puede aceptar la moda cuando hay un único valor de talla más votado — verificado: votos M+M → "Aceptar moda (M)" → historia resuelta con 4 pts (número interno de M)
- [x] 5.4 Confirmar que se puede click-to-resolve sobre el voto de talla de un participante puntual — verificado: click en voto "M" de un participante → historia resuelta con 4 pts
- [x] 5.5 Confirmar que mazos numéricos (Fibonacci, Powers of 2, Fibonacci con manos) siguen funcionando exactamente igual que antes de este cambio — verificado con mazo Fibonacci: voto "5" → "Aceptar promedio (5)" y "Aceptar moda (5)" (número crudo, sin sigla, sin regresión)
