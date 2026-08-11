# Hacer accesible la UI de sala

## Why

**Hay una función del producto que no se puede usar con teclado.** En [reveal-panel.html:18](../../../apps/web/src/app/ui/reveal-panel/reveal-panel.html):

```html
<li class="reveal-panel__vote--clickable" (click)="resolveVote.emit(numericVote)">
```

Un `<li>` con handler de click y nada más: sin `tabindex`, sin `role`, sin manejador de teclado. El moderador puede hacer clic en el voto de un participante para usarlo como puntuación final, pero **con teclado no hay forma de llegar ahí**, y un lector de pantalla no lo anuncia como accionable.

Esto no es marcado perfectible: el spec `estimation-session` ya especifica el escenario *"Moderador selecciona el voto de un participante como valor final"*, sin restringirlo a ningún medio de entrada. La implementación viola una capability que ya está escrita.

**Por qué ahora**: esos son los **2 únicos errores de lint** que quedan en todo el workspace después de la Fase 3.1, y por eso bloquean la Fase 1.1 del [roadmap](../../../docs/hardening-roadmap.md) — el gate de CI corre `nx affected -t lint test build`, así que mientras sigan ahí, todo PR que toque `web` nace en rojo.

El resto de la deuda de ARIA relevada en [known-issues.md](../../../docs/known-issues.md) entra en el mismo alcance por una razón práctica: **ninguno de esos otros elementos produce error de lint**, así que no hay nada que los vuelva a traer a la superficie. Si no se hacen ahora, se quedan.

## What Changes

Cinco elementos, en orden de gravedad:

1. **`reveal-panel` — voto seleccionable**: el `<li>` clickeable pasa a exponer un control real, focusable y activable con teclado. **Corrige un bug funcional**, no solo el lint.
2. **`reveal-panel` — botón "↻"**: su accessible name hoy es "↻" (el contenido de texto gana sobre `title`), no "Nueva ronda". Se agrega `aria-label`.
3. **`moderator-badge`**: `<span title="Moderador">🧙</span>` — un `title` en un `<span>` no participa del accessible name de forma confiable.
4. **`participant-list` — ícono del participante**: se renderiza sin label, antes del nombre.
5. **`icon-picker`**: los botones no comunican **cuál está seleccionado** — la selección solo existe visualmente, vía la clase `--selected`.

Además: los tests e2e usan `page.locator('button.reveal-panel__new-round')` como workaround justamente por el punto 2. Con el `aria-label` puesto, ese workaround deja de ser necesario.

## Capabilities

### New Capabilities

- `accessible-room-ui`: garantías de accesibilidad de la interfaz de sala — que toda acción disponible con mouse lo esté también con teclado, que los controles cuyo contenido visible es un emoji tengan un nombre accesible en español, y que el estado de selección se comunique por ARIA y no solo por color.

### Modified Capabilities

Ninguna.

`estimation-session` **no se modifica** a propósito. Su requirement *"Resolución manual de la historia"* ya dice que el moderador puede seleccionar el voto de un participante como valor final, sin restringirlo a un medio de entrada. El spec estaba bien; la implementación no lo cumplía. Agregar ahí un requisito de teclado duplicaría en dos capabilities una regla que corresponde a una sola.

## Impact

**Código** (todo en `apps/web`, solo capa de presentación)
- `apps/web/src/app/ui/reveal-panel/reveal-panel.html` y su `.scss`
- `apps/web/src/app/ui/moderator-badge/moderator-badge.ts` (template inline)
- `apps/web/src/app/ui/participant-list/participant-list.html`
- `apps/web/src/app/ui/icon-picker/icon-picker.html`

**Sin cambios de contrato ni de backend.** No se toca `shared-contracts`, `room-client-runtime` ni `realtime-api`. Los `output()` de los componentes y los mensajes de WebSocket quedan igual: cambia cómo se dispara la acción, no qué acción se dispara.

**Tests**
- `e2e/room-moderation.spec.ts` — el selector por clase de "Nueva ronda" puede migrar a `getByRole`.
- `docs/e2e-lessons-learned.md` — documenta ese workaround como aprendizaje; hay que revisarlo.

**Desbloquea**
- `nx lint web` pasa a **0 errores**, y con eso el workspace entero queda verde. Es el último prerrequisito de lint de la Fase 1.1.

**Riesgo visual**: convertir un `<li>` en un control real puede cambiar el layout si el `.scss` asume que es un `<li>`. Hoy la clase solo aporta `cursor: pointer` y un `:hover`, así que el riesgo es bajo — pero hay que mirarlo en el navegador, no solo pasar el lint.
