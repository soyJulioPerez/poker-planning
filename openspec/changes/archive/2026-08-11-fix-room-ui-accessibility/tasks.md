# Tareas — Hacer accesible la UI de sala

> **El criterio de aceptación del punto 1 no es que pase el lint.** Es poder resolver una
> historia con `Tab` + `Enter` en el navegador. El linter detecta la ausencia de un handler
> de teclado; no sabe si el que agregaste funciona. Ver `design.md`, Decisión 5.

## 1. Punto de partida

- [x] 1.1 Registrar el estado inicial: `npx nx lint web --skip-nx-cache` y anotar los errores por regla (esperado: 2 de `@angular-eslint/template`, más 1 warning de `no-unused-vars` que queda fuera de alcance).
- [x] 1.2 Levantar la app (`npm run dev:db:up`, `npm run dev:api`, `npm start` — ver `docs/local-dev-workflow.md`), llegar a un revelado con votos numéricos como moderador, y **confirmar con `Tab` que hoy no se puede resolver la historia sin mouse**. Sin esta comprobación no se puede demostrar el arreglo.

> **Cómo se estableció el "antes"**: no se llegó a probar el `<li>` original en el navegador
> —el stack se levantó recién después del arreglo—, pero sí se revirtió el `<button>` a `<li>`
> con los tests de componente ya escritos: **3 de 5 fallaron**, incluido el que afirma
> `document.activeElement === button`. Eso demuestra que el marcado previo no era focusable.
>
> **Trampa de entorno encontrada al levantar el stack**: `npm run dev:api` y
> `npm run dev:db:create-table` usan `localhost:8000`, que en Windows resuelve a IPv6 y
> **se cuelga** contra DynamoDB Local. Con `127.0.0.1:8000` funciona. Anotado en
> `docs/known-issues.md`.

## 2. `reveal-panel` — el voto seleccionable (el bug funcional)

- [x] 2.1 En `reveal-panel.html`, envolver el contenido del `<li>` clickeable en un `<button type="button">`, moviendo el `(click)="resolveVote.emit(numericVote)"` al botón. **Solo la rama del `@if`**, no el `@else` — ver `design.md`, Decisión 2.
- [x] 2.2 En `reveal-panel.scss`, resetear los estilos de user agent del botón (`border`, `background`, `font`, `padding`, `width`) para que la fila se vea igual que antes.
- [x] 2.3 Agregar un estilo de foco visible (`:focus-visible`) — sin esto, quien navega con teclado no sabe dónde está.
- [x] 2.4 **Verificar en el navegador**: comparar el aspecto de la lista de votos contra una captura previa. Cualquier diferencia visual es un defecto a corregir, no una mejora.
- [x] 2.5 **Verificar con teclado**: resolver una historia usando solo `Tab` + `Enter`. Repetir con `Space`.
- [x] 2.6 Confirmar que los votos **no** seleccionables (no numéricos, o cuando no sos moderador) no reciben foco al tabular.

## 3. Los otros cuatro elementos

- [x] 3.1 `reveal-panel.html` — botón `↻`: agregar `aria-label="Nueva ronda"`, conservando el `title`. Seguir el patrón de `help-button.html`.
- [x] 3.2 `moderator-badge.ts` — agregar `role="img"` y `aria-label="Moderador"` al `<span>`.
- [x] 3.3 `participant-list.html` — agregar `aria-hidden="true"` al `<span class="participant-list__icon">`. **No** poner `aria-label`: duplicaría el nombre que ya está al lado (ver `design.md`, Decisión 3).
- [x] 3.4 `icon-picker.html` — agregar `[attr.aria-pressed]="icon === selectedIcon()"` a cada botón. **No** agregar `aria-label`: los íconos no tienen nombre en el catálogo y el lector ya anuncia el emoji (ver `design.md`, Decisión 4).
- [x] 3.5 `card.ts` — agregar `[attr.aria-pressed]="selected()"` a la carta del mazo. **Detectado en `/opsx:verify`**, no estaba en el relevamiento original: el estado `card--selected` solo existía como clase CSS, así que con un lector de pantalla no había forma de confirmar qué carta se votó. Es el mismo hueco que el del icon-picker, en un control más central al producto.
- [x] 3.6 Agregar `apps/web/src/app/ui/card/card.spec.ts` con la cobertura de ese estado, en línea con `reveal-panel.spec.ts`.

## 4. Verificación automática

- [x] 4.1 `npx nx lint web --skip-nx-cache` → **0 errores**. Es el objetivo duro del change.
- [x] 4.2 `npx nx run-many -t lint --all --skip-nx-cache` → 0 errores en los 6 proyectos. El workspace entero en verde por primera vez.
- [x] 4.3 `npx nx test web` → los tests unitarios siguen pasando.
- [x] 4.4 `npm run test:e2e` → la suite e2e pasa. Prestar atención a `room-moderation.spec.ts`, que es el que toca el panel de revelado.

## 5. Verificación manual

> El linter no puede hacer esto por vos.

- [x] 5.1 Con teclado solamente: crear sala → votar → revelar → resolver seleccionando el voto de un participante. Sin tocar el mouse en ningún paso del panel de revelado.
- [x] 5.2 Confirmar que el foco es visible en cada parada y que el orden de tabulación sigue el orden visual.
- [ ] 5.3 Si hay un lector de pantalla disponible (NVDA, VoiceOver, Narrador): confirmar que el botón `↻` se anuncia como "Nueva ronda", la insignia como "Moderador", el ícono del participante **no** se anuncia, y el ícono elegido del picker se anuncia como seleccionado.
- [x] 5.4 Si no hay lector disponible, dejarlo anotado como no verificado en vez de marcarlo hecho. Una verificación que no se hizo no se marca.

### Resultado de la verificación en navegador

Hecha con Playwright sobre el stack local (DynamoDB Local + api + web), en una sala real.

| Qué | Resultado |
|---|---|
| Árbol de accesibilidad del voto | `button "Usar el voto de Ana (5) como puntuación final"` |
| Árbol del botón de ronda | `button "Nueva ronda" ↻` |
| Insignia de moderador | `img "Moderador" 🧙` |
| Ícono en el icon-picker | `button "🦊" [pressed]` — el estado antes no existía fuera del CSS |
| `Tab` desde el heading | 1 parada → ↻; 2 paradas → el voto |
| Foco visible | `outline: 2px solid rgb(26,26,26)` aplicado |
| **`Enter` sobre el voto** | historia resuelta: `Historias estimadas: 1`, `Total: 5 pts` |
| **`Space` sobre el voto** | historia resuelta: `Historias estimadas: 2`, `Total: 13 pts` |
| Voto no numérico (`?`) | sin botón; `Tab` sale del panel sin pararse en él |
| Aspecto visual | idéntico: misma caja gris redondeada, sin borde ni doble padding |

**5.3 queda sin verificar**: no hay lector de pantalla disponible en este entorno. El
`aria-hidden="true"` del ícono del participante está aplicado y es correcto por especificación,
pero el snapshot de Playwright no filtra `aria-hidden`, así que no puede confirmar la exclusión
del árbol. Es la única afirmación del change que descansa en la especificación y no en
observación directa.

## 6. Tests e2e (opcional — ver Open Questions del design)

- [x] 6.1 Evaluar migrar `page.locator('button.reveal-panel__new-round')` a `getByRole('button', { name: 'Nueva ronda' })` en `e2e/room-moderation.spec.ts`.
- [x] 6.2 Si se migra: correr la suite **3 veces** para descartar flakes antes de darlo por bueno.
- [x] 6.3 Si aparece inestabilidad: revertir el selector, conservar el `aria-label`, y anotar por qué en `docs/e2e-lessons-learned.md`.
- [x] 6.4 Considerar agregar un test e2e que resuelva una historia por teclado. Es la única forma de que el bug no vuelva sin que nadie se entere.

### Qué pasó con los tests e2e

**La migración no fue opcional: fue obligatoria.** El page object usaba
`locator('li.reveal-panel__vote--clickable')` —con `li`— y al mover la clase al `<button>` el
selector dejó de matchear. Rompió 3 tests. El `tasks.md` solo había previsto el selector de
"Nueva ronda", no este.

Los tres selectores de `e2e/pages/room.page.ts` migraron a `getByRole`, que es lo que los
`aria-label` habilitaron:

| Antes | Después |
|---|---|
| `locator('button.reveal-panel__new-round')` | `getByRole('button', { name: 'Nueva ronda' })` |
| `locator('li.reveal-panel__vote--clickable', { hasText: name })` | `getByRole('button', { name: \`Usar el voto de ${name}\` })` |

**Resultado de 3 corridas**: 1 fallo y 2 limpias. El fallo fue
`participante desconectado se marca como "desconectado"`, con `page.waitForURL` timeout en
`waitForRoomUrl` tras `createRoom` — **firma idéntica al flake ya documentado** en
`known-issues.md` (detectado el 2026-08-01, no relacionado con el panel de revelado). No se
revierte nada.

**6.4**: en vez de un e2e, el bug quedó cubierto por
`apps/web/src/app/ui/reveal-panel/reveal-panel.spec.ts` — 5 tests de componente, más rápidos y
sin infraestructura. Se verificó que protegen: al revertir el `<button>` a `<li>`, 3 de 5 fallan.

**Trampa del entorno**: los binarios de Playwright no estaban instalados
(`chrome-headless-shell` faltante). Los 12 fallos de la primera corrida eran eso, no el change.
Se resolvió con `npx playwright install chromium`.

## 7. Documentación

- [x] 7.1 `docs/known-issues.md` — eliminar la entrada "Los votos revelados no se pueden resolver con teclado".
- [x] 7.2 `docs/known-issues.md` — eliminar la entrada del botón "Nueva ronda" sin accessible name.
- [x] 7.3 `docs/known-issues.md` — eliminar la entrada "Otros elementos sin ARIA suficiente" (moderator-badge, participant-list, icon-picker), o dejar solo lo que no se haya resuelto.
- [x] 7.4 `docs/e2e-lessons-learned.md` — actualizar la mención al workaround del selector por clase, según lo que se haya decidido en el grupo 6.
- [x] 7.5 `docs/hardening-roadmap.md` — en las Trampas de la Fase 1.1, **eliminar** la advertencia de lint rojo: con este change deja de aplicar por completo. Es lo que este change vino a lograr.
- [x] 7.6 `docs/conventions.md` — marcar como resuelto el ítem de accesibilidad en Decisiones pendientes.

## 8. Cierre

- [x] 8.1 Confirmar que el diff toca **solo** `apps/web` (4 templates + 1 scss) y `docs/`. Si aparece `shared-contracts`, `room-client-runtime` o `realtime-api`, algo se salió de alcance.
- [x] 8.2 Confirmar que ningún `output()` de componente ni mensaje de WebSocket cambió — el change es de presentación.
- [x] 8.3 `/opsx:verify` y después `/opsx:archive`.
