## Context

`e2e/estimation-flow.spec.ts` (de `add-e2e-playwright-tests`) es hoy el único test e2e del repo. Cubre el camino feliz completo con el mazo Fibonacci y "Aceptar promedio". No toca ninguna de las ramas de rechazo del servidor ni la lógica de mazos con escala interna.

Fuentes de verdad usadas para diseñar los casos (confirmadas leyendo código, no supuestas):
- `openspec/specs/estimation-session/spec.md` — requirements a cubrir.
- `packages/shared-contracts/src/lib/decks.ts` — mazo Fibonacci (`0,1,2,3,5,8,13,21,34,?,☕,🧉`) y T-Shirt Sizes (`XS,S,M,L,XL,XXL,?,☕,🧉`, con escala interna `TSHIRT_NUMERIC_VALUES = {XS:1, S:2, M:4, L:8, XL:16, XXL:32}`; `?`/`☕`/`🧉` sin mapeo numérico).
- `apps/web/src/app/pages/home/home.html` — `<select name="deckId">` para elegir mazo al crear sala (label "Mazo de estimación", opciones = `deck.label`).
- `apps/web/src/app/ui/reveal-panel/reveal-panel.html` — botón "Aceptar moda (X)" no se renderiza si `mode.length !== 1` o la moda no es numérica; `<li class="reveal-panel__vote--clickable">` para resolver con el voto de un participante puntual (solo si el voto es numérico); botón "↻" con `title="Nueva ronda"` (sin texto visible "Nueva ronda").

## Goals / Non-Goals

**Goals:**
- Agregar `e2e/estimation-rules.spec.ts` cubriendo 8 casos de `estimation-session` no verificados hoy: precondición de historia para votar/revelar, moda empatada, moda no numérica sin escala, nueva ronda descarta votos, resolución con voto de un participante puntual, y tres casos del mazo T-Shirt (aceptar moda con escala interna, redondeo del promedio a la talla más cercana).
- Reutilizar la infraestructura Playwright existente (`playwright.config.mts`, `E2E_TARGET`, `webServer`) sin modificarla — mismo patrón de `browser.newContext()` por participante ya usado en `estimation-flow.spec.ts`.
- Selectores robustos (roles ARIA, texto visible, o clases estables ya usadas en el DOM) consistentes con el spec existente.

**Non-Goals:**
- No se cubre `room-management` (rol de moderador, reconexión, nombre duplicado) — alcance de un change separado (`add-e2e-room-moderation-coverage`).
- No se cubren `participant-identity`, `session-summary` ni `estimation-help-guide` — quedan fuera de este primer corte de priorización por riesgo.
- No se automatiza correr e2e en CI — sigue siendo no-goal heredado de `add-e2e-playwright-tests`.
- No se modifica `playwright.config.mts`, scripts npm, ni ningún archivo de `apps/web`/`apps/realtime-api`. Si algún caso revela una discrepancia real con el spec, se documenta como hallazgo y se resuelve aparte (no se "arregla" la app dentro de este change de testing).

## Decisions

### Decisión 0: Page Objects + fixtures de Playwright para todo `e2e/`, migrando también el spec existente
`estimation-flow.spec.ts` interactúa con la página de forma 100% inline (`page.getByRole(...)` repetido en cada paso). Con 8 casos nuevos en este change — más otros ~6 previstos en un change posterior de `room-management` — el setup repetido (crear sala, unirse, definir historia, votar, revelar) se volvería significativo si se mantiene inline.

Se introduce:
- `e2e/pages/home.page.ts` — `HomePage`: `createRoom(name, { deckLabel? })`, `joinRoom(roomId, name)`.
- `e2e/pages/room.page.ts` — `RoomPage`: `setStory(title)`, `vote(value)`, `reveal()`, `newRound()`, `acceptAverage()`, `acceptMode()`, `resolveWithParticipantVote(name)`, más getters de estado visible (conteo de votos, visibilidad del botón "Aceptar moda", etc.) usados en las aserciones.
- `e2e/fixtures.ts` — `test.extend<{ homePage: HomePage; roomPage: RoomPage }>`, una fixture por objeto (no fixtures de "escenario completo" como `roomWithTwoVoters`, para no sobre-construir antes de tener casos reales que lo justifiquen más allá de los ya mapeados).

**`estimation-flow.spec.ts` se migra a usar estos Page Objects/fixtures en este mismo change** — es un refactor de test (mismas aserciones, mismo comportamiento verificado, sin tocar `apps/web` ni `apps/realtime-api`), evita que `e2e/` tenga dos estilos conviviendo (uno inline, uno con Page Objects) desde el día uno de la abstracción.

**Alternativas descartadas**:
- *Page Object Model clásico sin fixtures* (instanciar `new RoomPage(page)` a mano en cada test) — se descarta a favor de fixtures porque Playwright ya provee inyección/composición nativa vía `test.extend`, evitando repetir la instanciación en cada archivo.
- *Fixtures de "escenario completo"* (ej. una fixture que ya entrega una sala con 2 participantes y una historia definida) — se descarta por ahora: de los 8 casos, cada uno varía el mazo, la cantidad de participantes o el momento exacto del flujo (algunos necesitan interrumpir antes de revelar), así que una fixture única de alto nivel terminaría con parámetros condicionales en vez de simplificar. Los Page Objects ya reducen el boilerplate línea por línea; se revisita si un change futuro muestra un patrón de setup verdaderamente repetido al 100%.

### Decisión 1: Un solo archivo `estimation-rules.spec.ts`, no uno por sub-tema
Los 8 casos son variaciones del mismo flujo base (sala → historia → votos → revelar), así que viven en un único spec con múltiples `test(...)`, en vez de fragmentarlos en archivos separados por deck o por regla. Mantiene el spec cohesivo con el estilo de `estimation-flow.spec.ts` (un archivo por capability).

### Decisión 2: Casos de "moda no numérica" (#4) y "nueva ronda" (#8) se fusionan en un solo test
No existe un botón para resolver directamente cuando la moda es un único valor no numérico (ej. "☕") — el único camino observable hacia adelante es "Nueva ronda". En vez de duplicar el setup de sala/historia para dos tests separados, un solo test cubre ambas aserciones en secuencia: (a) tras revelar con moda "☕" único, no aparece "Aceptar moda"; (b) el moderador hace click en "↻" y se verifica que el conteo de votos vuelve a 0 y el mazo queda disponible para votar de nuevo.

### Decisión 3: Selector del botón "Nueva ronda" vía `title`, no vía texto visible
El botón no tiene texto de contenido, solo `title="Nueva ronda"` sobre el ícono "↻". Se usa `getByRole('button', { name: 'Nueva ronda' })` — Playwright resuelve `name` accesible también desde `title` cuando no hay texto de contenido, evitando depender del carácter "↻" (frágil si cambia el ícono).

### Decisión 4: Resolución con voto de participante puntual vía el `<li>` clickeable, no un `<button>`
`reveal-panel.html` implementa esa interacción como `<li class="reveal-panel__vote--clickable">` con `(click)`, no como botón semántico. Se usa un locator por texto compuesto (nombre + valor) dentro de `.reveal-panel__vote--clickable`, ya que no hay rol ARIA de botón disponible ahí. Se documenta esta desviación de "preferir roles ARIA" porque la propia implementación no expone un rol de botón — no se justifica cambiar la app solo para el test.

### Decisión 5: Selección de mazo T-Shirt vía el `<select name="deckId">` en Home
Los casos T-Shirt (#6, #7) requieren crear la sala con `deckId` distinto al default. Se usa `page.getByLabel('Mazo de estimación').selectOption({ label: 'T-Shirt Sizes' })` (o el label exacto confirmado en `decks.ts`) antes de enviar el formulario de "Crear sala", análogo al llenado de nombre ya usado en `estimation-flow.spec.ts`.

### Decisión 6: Valores concretos elegidos para evitar ambigüedad en los cálculos
- Empate de moda (#3): votos "3" y "5" (Fibonacci) — un voto cada valor, empate 1-1, promedio (4) sigue siendo aceptable para no dejar el test sin forma de cerrar la historia.
- Redondeo T-Shirt (#7): votos "S" (2) y "L" (8) → promedio interno 5 → distancia a "M"(4) es 1, a "L"(8) es 3 → la talla más cercana es "M", valor esperado al aceptar: 4 pts. Elegido porque dista de forma inequívoca de ambos extremos (no es un caso de empate de distancia).

## Risks / Trade-offs

- [Riesgo] Los nombres exactos de labels (`"Mazo de estimación"`, `deck.label` de T-Shirt Sizes) fueron confirmados por lectura de código en esta sesión, pero podrían diferir sutilmente en el HTML renderizado (espacios, mayúsculas) → Mitigación: durante la implementación, verificar con un run real antes de dar el spec por bueno, igual que hizo `add-e2e-playwright-tests` con sus selectores.
- [Riesgo] `getByRole('button', { name: 'Nueva ronda' })` depende de que Playwright exponga `title` como accessible name cuando no hay texto de contenido — comportamiento estándar pero vale confirmarlo en la implementación; si falla, fallback a `page.locator('button.reveal-panel__new-round')`.
- [Trade-off] No se agrega ningún caso para mazos con `displayValues` decorativos (ej. "🍼 XS" de `tshirt-icons`) ya cubiertos conceptualmente por el requirement "Mazo con variante visual conserva el valor de voto real" — se prioriza T-Shirt Sizes plano por ser el caso base de escala interna; la variante decorativa queda como extensión futura de bajo riesgo (es un alias de presentación, no una regla de negocio distinta).
- [Riesgo] Igual que en el spec existente, correr contra AWS (`E2E_TARGET=aws`) puede sufrir latencia/cold start de Lambda → Mitigación: mismo mecanismo ya presente (timeouts ampliados condicionados a `isAws`), sin necesidad de lógica nueva.

## Migration Plan

Sin datos de producción afectados; cambio aditivo (un archivo de test nuevo). Pasos:
1. Escribir `e2e/estimation-rules.spec.ts` con los 8 casos.
2. Correr `nx e2e e2e` en modo local (`test:e2e`) y confirmar que los 8 casos pasan contra el backend local.
3. Opcionalmente correr `test:e2e:aws` para confirmar estabilidad contra el stack real (mismo trade-off de latencia ya documentado en `docs/local-dev-workflow.md`).

Sin plan de rollback especial — revertir el commit restaura el estado anterior sin efectos secundarios.

## Open Questions

- Label exacto de "T-Shirt Sizes" en el `<select>` — a confirmar leyendo `deck.label` en `decks.ts` durante la implementación (se asume que coincide con el `id`-friendly name ya citado en este documento).
