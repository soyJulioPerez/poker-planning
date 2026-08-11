# Diseño — Hacer accesible la UI de sala

## Context

Cinco elementos de `apps/web` con problemas de accesibilidad, relevados en `known-issues.md` y verificados en el código. Solo uno produce error de lint; los otros cuatro son invisibles para el tooling.

| # | Dónde | Qué pasa | ¿Lint lo ve? |
|---|---|---|---|
| 1 | `reveal-panel.html:18` | `<li>` con `(click)` sin teclado ni foco | **Sí** (2 errores) |
| 2 | `reveal-panel.html:11` | Botón `↻` con `title` pero sin `aria-label` | No |
| 3 | `moderator-badge.ts:5` | `<span title="Moderador">🧙</span>` | No |
| 4 | `participant-list.html:8` | Ícono del participante sin label | No |
| 5 | `icon-picker.html:3-10` | Selección solo por clase CSS | No |

El repo ya tiene el patrón correcto en `help-button.html`:

```html
<button type="button" class="help-button" title="Guía de estimación"
        aria-label="Abrir guía de estimación" (click)="opened.emit()">💡</button>
```

`title` para el tooltip visual, `aria-label` para el nombre accesible. Sirve de modelo para el resto.

## Goals / Non-Goals

**Goals:**

- Que resolver una historia sea posible con teclado. Es un bug funcional, no un detalle de marcado.
- Que `nx lint web` quede en **0 errores**, desbloqueando el último prerrequisito de lint de la Fase 1.1.
- Que los cinco elementos queden resueltos, no solo el que grita.
- Verificación con teclado real, no solo con el linter.

**Non-Goals:**

- **No se rediseña visualmente nada.** Si algo cambia de aspecto, es efecto colateral a corregir, no una mejora buscada.
- **No se toca `shared-contracts`.** Ver Decisión 4: sería la forma "correcta" de nombrar los íconos, pero cambia un contrato compartido con mobile por un beneficio que resulta ser menor de lo que parece.
- **No se audita `apps/mobile`.** Tiene su propia UI y sus propios problemas; mezclarlos duplicaría el alcance.
- **No se hace una auditoría WCAG completa.** Este change cierra la deuda relevada, no abre un programa de accesibilidad. Contraste, orden de foco global y navegación por landmarks quedan fuera.

## Decisions

### Decisión 1: el voto seleccionable pasa a ser un `<button>`, no un `<li>` parcheado

**Elegido**: envolver el contenido en un `<button type="button">` dentro del `<li>`.

```html
<li>
  <button type="button" class="reveal-panel__vote--clickable"
          (click)="resolveVote.emit(numericVote)">
    ...
  </button>
</li>
```

**Alternativa descartada — `tabindex="0"` + `role="button"` + `(keydown)`**: es lo que sugiere el mensaje del linter y silencia los dos errores. Pero obliga a reimplementar a mano lo que el navegador ya hace: activación con `Enter` **y** con `Space` (que se comportan distinto), el foco, el estado `:active`, el manejo de `disabled`. Cada una de esas piezas es una oportunidad de equivocarse, y ninguna se testea sola.

Un `<button>` trae todo eso gratis y correcto. La regla general: cuando existe un elemento nativo con la semántica que se necesita, usarlo gana casi siempre sobre construirlo con ARIA.

**Consecuencia a vigilar**: los estilos. Hoy `.reveal-panel__vote--clickable` solo aporta `cursor: pointer` y un `:hover`, pero un `<button>` trae de fábrica `border`, `background`, `font` y `padding` propios del user agent. Hay que resetearlos explícitamente para que el aspecto no cambie. Es la parte del change con más riesgo visual y la que hay que mirar en el navegador.

**Por qué el `<button>` va adentro del `<li>` y no en lugar de él**: la lista sigue siendo una lista de votos. Convertir el `<li>` en `<button>` rompería la semántica de `<ul>`, que exige `<li>` como hijo directo.

### Decisión 2: solo el voto *seleccionable* es un control

En el template hay dos ramas: `@if (isModerator() && voteAsNumber(entry.value))` renderiza el voto clickeable, y el `@else` renderiza un `<li>` inerte.

**Solo la primera lleva `<button>`.** La segunda queda como está.

Es deliberado: un control focusable que no hace nada es peor que ningún control. Quien navega con `Tab` espera que cada parada tenga una acción. Si los votos no numéricos —o todos los votos, cuando quien mira no es moderador— capturaran el foco, la navegación se llenaría de paradas muertas.

Esto también significa que **la cantidad de paradas de `Tab` depende del rol y del mazo**. Es correcto: refleja que las acciones disponibles son distintas.

### Decisión 3: `aria-label` donde el emoji es la acción; `aria-hidden` donde el emoji es decoración

Los cinco casos no son el mismo problema y no llevan la misma solución:

| Elemento | Tratamiento | Por qué |
|---|---|---|
| Botón `↻` nueva ronda | `aria-label="Nueva ronda"` | Es un control; el emoji **es** la etiqueta y no dice nada |
| Insignia 🧙 moderador | `role="img"` + `aria-label="Moderador"` | No es interactivo pero **aporta información** que no está en el texto |
| Ícono del participante | `aria-hidden="true"` | **Duplica** información: el nombre ya identifica a la persona |
| Botones del icon-picker | Ver Decisión 4 | |

El criterio: **¿el emoji aporta información que no está en otro lado?** Si sí, se le da nombre. Si no, se lo saca del árbol de accesibilidad para no generar ruido.

El caso del ícono del participante es el que más se presta a equivocarse. La tentación es agregar `aria-label="Ícono de Juan"`, pero eso hace que el lector anuncie "Ícono de Juan, Juan". El ícono es identidad visual, no información: `aria-hidden` es la respuesta correcta.

### Decisión 4: en el icon-picker se agrega `aria-pressed`, no `aria-label`

Este es el caso donde el relevamiento inicial se equivocó de problema.

`known-issues.md` recomendaba `[attr.aria-label]="'Ícono ' + icon"`. Pero los íconos en `shared-contracts` son **strings pelados**, sin nombre asociado:

```ts
export const ANIMALS_ICON_GROUP: IconGroup = {
  id: 'animals', label: 'Animales',
  icons: ['🐶', '🐱', '🦊', '🐼', ...],   // sin nombres
};
```

Así que `aria-label="Ícono 🐶"` haría que se anuncie *"Ícono cara de perro"* — peor que dejar que el lector anuncie el emoji solo, que ya da *"cara de perro, botón"*. **Los lectores de pantalla ya saben leer emoji.** El label no era el problema.

Lo que sí falta es el **estado**: cuál está elegido solo existe como la clase `icon-picker__item--selected`, invisible para quien no ve la pantalla. Eso se arregla con `[attr.aria-pressed]="icon === selectedIcon()"`.

**Alternativa descartada — agregar `name` a cada ícono en `shared-contracts`**: daría nombres en español ("Perro" en vez de "cara de perro") y sería más prolijo. Pero cambia un contrato compartido con mobile, obliga a nombrar 36 emojis a mano, y el beneficio sobre lo que ya hace el lector es marginal. Si algún día los grupos de íconos crecen o se traducen, ahí se reevalúa.

### Decisión 5: verificar con teclado, no con el linter

El criterio de aceptación del punto 1 **no** es que el lint pase. Es poder resolver una historia usando solo `Tab` y `Enter`, en el navegador.

El linter solo detecta la ausencia de un handler de teclado; no sabe si el que agregaste funciona, si el foco es visible, ni si el orden de tabulación tiene sentido. Un `tabindex="-1"` mal puesto pasa el lint y rompe la función.

Es la misma lección que dejó la Fase 3.1: una regla que nunca se vio funcionar no se sabe si funciona.

## Risks / Trade-offs

**[El `<button>` rompe el layout del voto]** → Es el riesgo principal. Los estilos de user agent de `<button>` (borde, fondo, fuente, padding) se heredan y pueden desalinear la fila. Mitigación: resetear explícitamente en el `.scss` y **verificar en el navegador**, no darlo por bueno porque el lint pasa.

**[Cambia la cantidad de paradas de `Tab` y algún e2e se rompe]** → Ningún test actual navega por teclado, así que el riesgo es bajo. Pero si alguno usa índices de foco implícitos, va a fallar. Se corre la suite completa.

**[El `aria-hidden` del ícono del participante se considera pérdida de información]** → Es un juicio, no un hecho. Si más adelante se decide que el ícono sí aporta (por ejemplo, si dos participantes pudieran tener el mismo nombre), se revierte a `role="img"` + label. Queda registrado acá para que la decisión sea rastreable.

**[Migrar el selector e2e a `getByRole` introduce un flake]** → Los tests de este repo ya tienen historial de inestabilidad (ver `known-issues.md`). Mitigación: migrar el selector es **opcional** dentro de este change; si el test se pone inestable, se deja el selector por clase y se anota. No vale la pena cambiar un test que funciona por elegancia.

## Migration Plan

Sin migración de datos ni de despliegue: es capa de presentación.

1. `reveal-panel` — el `<button>` y su reset de estilos. Verificar en navegador.
2. Los cuatro casos de `aria-label` / `aria-hidden` / `aria-pressed`.
3. `nx lint web` en verde y suite de tests completa.
4. Verificación manual con teclado y, si está disponible, con lector de pantalla.
5. Documentación: cerrar las entradas de `known-issues.md` y actualizar el roadmap.

**Rollback**: revertir el commit. Sin estado persistente ni contrato modificado.

## Open Questions

**¿Se migra el selector e2e de "Nueva ronda" a `getByRole`?**

Con el `aria-label` puesto, `getByRole('button', { name: 'Nueva ronda' })` empieza a funcionar y el workaround por clase CSS deja de ser necesario. Migrarlo cierra el círculo y valida el `aria-label` desde un test real.

Pero `docs/e2e-lessons-learned.md` documenta ese workaround como aprendizaje, y los e2e de este repo tienen historial de flakes. La recomendación de este diseño es **migrarlo y correr la suite varias veces**; si aparece inestabilidad, revertir el selector y dejar el `aria-label` igual —que es lo que importa para el producto— anotando por qué.
