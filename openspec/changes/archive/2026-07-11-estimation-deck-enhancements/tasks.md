## 1. Shared contracts — modelo de datos

- [x] 1.1 Agregar `displayValues?: string[]` a la interfaz `DeckOption` en `packages/shared-contracts/src/lib/domain.ts`
- [x] 1.2 Agregar `'🧉'` a `values` de `FIBONACCI_DECK`, `POWERS_OF_TWO_DECK` y `TSHIRT_DECK` en `decks.ts` (después de `'☕'`)

## 2. Shared contracts — mazo "Fibonacci con manos"

- [x] 2.1 Definir `HAND_FIBONACCI_DECK: DeckOption` en `decks.ts` con `values: ['0','1','2','3','5','8','13','21','34','?','☕','🧉']` y `displayValues` alineado según la tabla del design.md (`'✊ 0'`, `'☝ 1'`, `'✌ 2'`, `'🤟 3'`, `'✋ 5'`, `'✋✌ 8'`, `'✋✋✋☝ 13'`, `'✋✋✋✋✌ 21'`, `'✋✋✋✋✋✋✌✌ 34'`, y `'?'`/`'☕'`/`'🧉'` sin decoración)
- [x] 2.2 Agregar `HAND_FIBONACCI_DECK` a `AVAILABLE_DECKS`

## 3. Shared contracts — mazo "T-Shirt con iconos"

- [x] 3.1 Definir `TSHIRT_WITH_ICONS_DECK: DeckOption` en `decks.ts` con `values: ['XS','S','M','L','XL','XXL','?','☕','🧉']` y `displayValues: ['🍼 XS','🧒 S','🧑‍🦱 M','🧑 L','🧔 XL','👴 XXL', '?', '☕', '🧉']`
- [x] 3.2 Agregar `TSHIRT_WITH_ICONS_DECK` a `AVAILABLE_DECKS`

## 4. Frontend — renderizado de displayValues

- [x] 4.1 Actualizar `VotingBoard` (`apps/web/src/app/ui/voting-board/voting-board.ts`/`.html`) para recibir `displayValues?: string[]` además de `deckValues` y pasarle a cada `Card` el texto a mostrar junto con el valor real
- [x] 4.2 Actualizar `Card` (`apps/web/src/app/ui/card/card.ts`) para aceptar un input `displayValue?: string` — muestra `displayValue() ?? value()` en el botón, pero sigue emitiendo/comparando siempre `value()`
- [x] 4.3 Actualizar `room.ts`/`room.html` para pasar `deck.displayValues` a `VotingBoard` junto con `deck.values`

## 5. Tests

- [x] 5.1 Actualizar `decks.spec.ts`: agregar test que verifica que todo mazo con `displayValues` definido tiene `displayValues.length === values.length`
- [x] 5.2 Agregar test que verifica que `'☕'` y `'🧉'` están presentes en los `values` de los 5 mazos de `AVAILABLE_DECKS`

## 6. Validación manual

- [x] 6.1 Crear una sala con el mazo "Fibonacci con manos"; votar con una carta decorada (ej. "✋☝ 6") y confirmar que el voto se registra y se revela como "6", no como el texto decorativo
- [x] 6.2 Con varios votos numéricos en "Fibonacci con manos", confirmar que el promedio y la moda se calculan correctamente tras revelar
- [x] 6.3 Crear una sala con el mazo "T-Shirt con iconos" y confirmar que cada carta muestra el emoji junto a la sigla (ej. "🍼 XS")
- [x] 6.4 Confirmar visualmente que ninguna carta decorada desborda el tamaño de la carta en la UI; ajustar CSS si es necesario
- [x] 6.5 Confirmar que "☕" y "🧉" aparecen como cartas separadas en los 5 mazos, y que ambas quedan excluidas del promedio/moda al votarlas
