# Problemas conocidos

## Test runner de componentes Angular roto (vitest-analog)

**Síntoma**: `npx nx run web:vite:test` falla con `Error: Need to call TestBed.initTestEnvironment() first` y `TypeError: Cannot read properties of null (reading 'ngModule')` en cualquier spec que use `TestBed` (incluido el spec `app.spec.ts` generado por el propio scaffold de Nx, sin modificar).

**Causa probable**: incompatibilidad de versiones entre Angular `21.2.9` (muy reciente) y `@analogjs/vitest-angular@2.2.0` / `@analogjs/vite-plugin-angular@2.2.0`, que el generador de Nx instaló como parte del preset `unitTestRunner=vitest-analog`.

**Confirmado que no es un problema de código propio**: un test trivial sin `TestBed` (`expect(1+1).toBe(2)`) pasa sin problemas en el mismo archivo/proyecto. Solo falla la inicialización de `TestBed`.

**Impacto**: no se pueden correr tests unitarios de componentes Angular por ahora. El build de producción (`nx build web`) y el dev server (`nx serve web`) funcionan con normalidad — no es un problema del código de la aplicación, solo del test runner.

**Decisión**: se deja como deuda técnica anotada. La verificación de cada incremento del MVP se hace manualmente en el navegador (como pide `tasks.md`), no depende de estos tests.

**Posibles soluciones a futuro** (no aplicadas):
- Fijar una versión de Angular más antigua y probada contra `@analogjs/vitest-angular`.
- Actualizar `@analogjs/vitest-angular` a una versión más nueva cuando exista soporte confirmado para Angular 21.x.
- Migrar el test runner de `web` a Jest con `@angular-builders/jest` u otra combinación más estable, si el problema persiste.

## Botón "Nueva ronda" sin accessible name descriptivo

**Síntoma**: el botón "↻" del panel de revelado (`apps/web/src/app/ui/reveal-panel/reveal-panel.html`) tiene `title="Nueva ronda"`, pero su accessible name real (según ARIA/accessible-name computation) es el texto de contenido visible "↻", no el `title`. Cualquier código que intente ubicarlo por nombre accesible "Nueva ronda" (por ejemplo `getByRole('button', { name: 'Nueva ronda' })` en Playwright) no lo encuentra, porque el contenido de texto tiene prioridad sobre `title` en el cálculo del accessible name.

**Confirmado en**: `openspec/changes/add-e2e-estimation-rules-coverage` — el test e2e de "nueva ronda" tuvo que usar el selector `page.locator('button.reveal-panel__new-round')` como workaround en vez de `getByRole` por nombre.

**Impacto**: además de complicar los selectores de test, lectores de pantalla anuncian el botón como "↻" (un carácter sin significado semántico) en vez de "Nueva ronda", afectando la accesibilidad real de la app, no solo la testeabilidad.

**Recomendación**: agregar `aria-label="Nueva ronda"` al `<button class="reveal-panel__new-round">` (además o en reemplazo del `title` existente), de forma que el accessible name sea "Nueva ronda" tanto para lectores de pantalla como para selectores de test basados en rol/nombre. No aplicado en este change por ser un ajuste de `apps/web` fuera de alcance de un change de testing puro.

## Otros elementos sin ARIA suficiente (relevado junto con el caso anterior)

Al revisar `apps/web/src/app/ui/reveal-panel/reveal-panel.html` por el botón "Nueva ronda", se relevó el resto de la UI en busca del mismo patrón (contenido visible = un emoji/ícono sin texto, sin `aria-label` que lo explique). `apps/web/src/app/ui/help-button/help-button.html` y `help-modal.html` ya siguen la práctica correcta (`aria-label="Abrir guía de estimación"`, `aria-label="Cerrar guía de estimación"`) — sirven de referencia del patrón a aplicar en los siguientes:

- **`apps/web/src/app/ui/moderator-badge/moderator-badge.ts`**: `<span class="moderator-badge" title="Moderador">🧙</span>`. Un `title` en un `<span>` no participa del accessible name de forma confiable para todos los lectores de pantalla (a diferencia de un `<button>`/control interactivo). **Recomendación**: agregar `role="img" aria-label="Moderador"` al span, para que se anuncie como "Moderador" y no como una interpretación literal del emoji (ej. "mago").

- **`apps/web/src/app/ui/participant-list/participant-list.html`** (línea `<span class="participant-list__icon">{{ participant.icon }}</span>`): el ícono elegido por el participante (ver capability `participant-identity`) se renderiza sin ningún label, antes del nombre. **Recomendación**: agregar `aria-hidden="true"` si se considera puramente decorativo (el nombre ya identifica al participante y el ícono no aporta información nueva), o `role="img" aria-label="Ícono de {{ participant.name }}"` si se prefiere que sea anunciado explícitamente. Se recomienda la primera opción (`aria-hidden`) para no duplicar información ya presente en el nombre.

- **`apps/web/src/app/ui/icon-picker/icon-picker.html`**: la grilla de selección de ícono (usada al crear sala y al unirse, ver capability `participant-identity`) renderiza cada `<button>` con el emoji como único contenido, sin `aria-label` que indique qué ícono representa cada botón, y sin `aria-pressed` para comunicar cuál está seleccionado (la selección solo se distingue visualmente vía `icon-picker__item--selected`). **Recomendación**: agregar `[attr.aria-label]="'Ícono ' + icon"` (o una descripción más rica si en el futuro el catálogo de íconos define nombres, ej. "Perro" en vez de "🐶") y `[attr.aria-pressed]="icon === selectedIcon()"` a cada botón.

## Test e2e inestable: reconexión automática (marcado `test.fixme`)

**Síntoma**: el test `reconexión automática restaura el voto sin necesidad de re-votar` (`e2e/room-moderation.spec.ts`) falla de forma intermitente con `TimeoutError: page.waitForURL: Timeout 10000ms exceeded`, esperando la navegación a `/room/<código>` justo después de que el **moderador** crea la sala — es decir, falla en el paso más básico del test, antes incluso de llegar a la lógica de reconexión en sí.

**Lo que se descartó como causa** (confirmado durante `openspec/changes/add-e2e-room-moderation-coverage`):
- No es contención de otros tests corriendo en paralelo: falla incluso con `nx e2e e2e -- -g "reconexión"` (`--workers=1`, un solo test, sin ningún otro compitiendo por recursos).
- No es una tabla de DynamoDB Local faltante/corrupta: se confirmó la tabla presente y se recreó desde cero en varias corridas de diagnóstico.
- No es un bug de lógica del test: el mismo código, estructuralmente casi idéntico a otros tests del mismo archivo que sí pasan de forma consistente (ej. `un participante no-moderador no ve controles de moderación`), fallaba y pasaba de forma alternada según el estado acumulado del proceso `realtime-api`/DynamoDB Local en el momento de la corrida.
- Corriendo con `--trace=on` (que ralentiza/serializa la ejecución) el test pasaba consistentemente, sugiriendo una condición de carrera sensible a timing, pero no se logró aislar la causa raíz exacta antes de pausar la investigación automatizada.

**Estado**: el test se dejó marcado con `test.fixme(...)` en vez de `test.skip(...)` — comunica que hay un problema real pendiente de resolver, no una decisión deliberada de no cubrir este caso. El resto de la suite (12/13 tests de `room-moderation.spec.ts` + `estimation-rules.spec.ts` + `estimation-flow.spec.ts`) pasa de forma estable.

**Pasos para reproducir y diagnosticar manualmente** (pendiente, no completado en esta sesión):

1. Levantar el entorno local completo siguiendo `docs/local-dev-workflow.md` (DynamoDB Local + `npm run dev:api` + `npm start`), confirmando que las 3 terminales muestran arranque limpio sin errores.
2. Abrir dos pestañas del navegador en `http://localhost:4200`.
3. Pestaña 1: crear una sala con nombre "Moderador E2E" (mazo Fibonacci, cualquier configuración). Confirmar que navega a `/room/<código>` sin demora perceptible.
4. Pestaña 2: unirse a esa sala con el código, nombre "Participante E2E".
5. Definir una historia desde la pestaña del moderador, votar "5" en ambas pestañas, confirmar "2 de 2 votaron".
6. **Cerrar la pestaña 2 por completo** (no solo navegar afuera — cerrar la pestaña/ventana, simulando pérdida de conexión real).
7. Abrir una **pestaña nueva** (no reutilizar la cerrada) en `http://localhost:4200`, unirse a la misma sala con el mismo nombre "Participante E2E".
8. Verificar en la pestaña del moderador que el conteo sigue mostrando "2 de 2 votaron" sin que el participante reconectado haya vuelto a votar.
9. Repetir los pasos 1-8 varias veces seguidas (5-10 veces), cronometrando cuánto tarda el paso 3 (crear sala → navegar) en cada repetición. Si en alguna repetición ese paso tarda notablemente más que en las demás (o nunca navega), es la misma condición que afecta al test — anotar en qué repetición ocurrió y si coincide con algún patrón (ej. después de cierta cantidad de salas creadas en la sesión).

**Qué buscar si el paso 9 reproduce el problema**: revisar la consola del navegador (F12) en el momento del cuelgue en busca de errores de WebSocket, y el log de la terminal de `dev:api` en busca de excepciones no capturadas o de un `ResourceNotFoundException`/timeout de DynamoDB — este mismo diagnóstico ya identificó que un `docker restart dynamodb-local` sin recrear la tabla causa exactamente este síntoma (ver comando `npm run dev:db:create-table` en `docs/local-dev-workflow.md`), así que vale la pena descartar eso primero si el contenedor fue reiniciado en algún momento de la sesión.

**Si el paso 9 NO reproduce nada anómalo tras varias repeticiones**: el problema podría ser específico del entorno de la máquina donde se corrieron los tests originalmente (recursos limitados, muchos procesos Node acumulados de sesiones previas — se observaron varios procesos zombie reteniendo los puertos 3001/9229 durante el diagnóstico), no de la lógica de la aplicación. En ese caso, se puede intentar quitar `test.fixme` y volver a correr la suite completa para ver si el problema persiste en un entorno más limpio.
