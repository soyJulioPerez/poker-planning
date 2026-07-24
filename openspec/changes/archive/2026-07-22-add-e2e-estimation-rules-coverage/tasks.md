## 1. Page Objects y fixtures

- [x] 1.1 Crear `e2e/pages/home.page.ts` (`HomePage`): `createRoom(name, { deckLabel? })`, `joinRoom(roomId, name)` — encapsulando los locators ya usados en `estimation-flow.spec.ts` (botón "Crear sala" dentro del form, textbox "Tu nombre", textbox "Código de sala", botón "Unirse"). **Desviación**: el formulario de "Crear sala" está oculto hasta hacer click en el tab correspondiente (tab "Unirse a sala" es el default); `createRoom` hace ese click de tab antes de llenar el formulario.
- [x] 1.2 Extender `HomePage.createRoom` para soportar selección opcional de mazo vía `page.getByLabel('Mazo de estimación').selectOption(...)` — confirmado el label exacto y `label: 'T-Shirt Sizes'` en `packages/shared-contracts/src/lib/decks.ts`.
- [x] 1.3 Crear `e2e/pages/room.page.ts` (`RoomPage`): `setStory(title)`, `vote(value)`, `reveal()`, `newRound()`, `acceptAverage()`, `acceptMode()`, `resolveWithParticipantVote(name)`, y getters de estado (`revealButton()`, `voteCard()`, `acceptAverageButton()`, `acceptModeButton()`, `voteProgressText()`, `lastResolvedStoryText()`, `votingBoard()`).
- [x] 1.4 **Desviación confirmada**: `getByRole('button', { name: 'Nueva ronda' })` NO resuelve — el botón "↻" tiene contenido de texto visible ("↻"), así que Playwright usa ese texto como accessible name en vez del atributo `title="Nueva ronda"`. Aplicado el fallback ya documentado en `design.md`: `page.locator('button.reveal-panel__new-round')`.
- [x] 1.5 Crear `e2e/fixtures.ts` con `test.extend<{ homePage: HomePage; roomPage: RoomPage }>`, exportando `test`/`expect`.

## 2. Migrar el spec existente

- [x] 2.1 Migrar `e2e/estimation-flow.spec.ts` para usar `HomePage`/`RoomPage`/fixtures en vez de locators inline, sin cambiar ninguna aserción existente.
- [x] 2.2 Corrido `nx e2e e2e` (modo local): `estimation-flow.spec.ts` pasa igual que antes de la migración (tras corregir la desviación 1.1 del click de tab).

## 3. Precondiciones de historia (voto/revelado)

- [x] 3.1 Test: crear sala sin definir historia — assert que el botón "Revelar votos" no está visible/habilitado (implementado como `toHaveCount(0)`, ya que el botón no se renderiza en absoluto sin `currentStoryTitle`).
- [x] 3.2 Test: crear sala sin definir historia — assert que el mazo de votación no está disponible para seleccionar una carta (implementado como `toHaveCount(0)` sobre `.voting-board`, mismo motivo).

## 4. Moda empatada y nueva ronda

- [x] 4.1 Test: mazo Fibonacci, dos participantes votan "3" y "5" (empate 1-1) — tras revelar, assert que "Aceptar moda" no existe y que "Aceptar promedio (4)" sí está disponible.
- [x] 4.2 Test (encadenado con 4.1, mismo archivo): dos participantes votan "☕" y "☕" (moda única no numérica) — tras revelar, assert ausencia de "Aceptar moda" y de "Aceptar promedio" (mazo no numérico sin valor promediable); moderador hace click en "Nueva ronda"; assert que el conteo de votos vuelve a "0 de 2 votaron" y el mazo queda disponible (`toBeEnabled()`) para votar de nuevo en ambas páginas.

## 5. Resolución con voto de participante puntual

- [x] 5.1 Test: mazo Fibonacci, dos participantes votan "3" y "8" — tras revelar, moderador hace click en el `<li class="reveal-panel__vote--clickable">` correspondiente al voto "8" del participante — assert que la historia queda resuelta con 8 pts.

## 6. Mazo T-Shirt Sizes

- [x] 6.1 Test: crear sala con mazo "T-Shirt Sizes", dos participantes votan "M" y "M" — tras revelar, assert "Aceptar moda (M)" visible; al aceptar, assert historia resuelta. **Desviación**: el mensaje final muestra la etiqueta de talla ("M"), no el número interno (4) — `room.ts#valueLabel()` convierte el número interno de vuelta a la etiqueta de mazo para mostrarlo. Assert ajustado a "resuelta con M pts" (el servidor sí registra 4 internamente; no se verifica ese detalle interno desde e2e).
- [x] 6.2 Test: crear sala con mazo "T-Shirt Sizes", dos participantes votan "S" (2) y "L" (8) — tras revelar, assert que el botón de aceptar promedio muestra la etiqueta "M" (talla más cercana al promedio interno 5); al aceptar, mismo criterio de 6.1 ("resuelta con M pts").

## 7. Verificación

- [x] 7.1 Corrido `nx e2e e2e` (modo local) de punta a punta: los 7 tests (8 casos, 4.1+4.2 comparten spec) y el spec migrado pasan consistentemente.
- [x] 7.2 Corrido `E2E_TARGET=aws nx e2e e2e --skip-nx-cache` dos veces contra el stack real: 5-7 de 7 tests pasan por corrida, con fallos no determinísticos (`TimeoutError` en `waitForURL` tras crear sala, distinto test afectado en cada corrida) — misma inestabilidad de latencia/cold start ya documentada en `docs/local-dev-workflow.md` por `add-e2e-playwright-tests`, no un defecto de los tests nuevos. No se investiga más allá de eso en este change, tal como estaba previsto.
