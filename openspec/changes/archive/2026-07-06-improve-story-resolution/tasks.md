## 1. Eliminar bloque de próxima historia en fase revealed

- [x] 1.1 Quitar el input + botón "Siguiente historia" de la fase `roundPhase === 'revealed'` en `room.html`

## 2. RevealPanel: click en voto para resolver

- [x] 2.1 Agregar `input<boolean>()` (ej. `isModerator`) a `RevealPanel`
- [x] 2.2 Agregar `output<number>()` (ej. `resolveVote`) a `RevealPanel`
- [x] 2.3 En `reveal-panel.html`, hacer clickeable cada voto numérico solo cuando `isModerator()` es `true`, emitiendo `resolveVote` con el valor
- [x] 2.4 Agregar estilos de interactividad (cursor pointer, hover) en `reveal-panel.scss` para los votos clickeables
- [x] 2.5 Mostrar texto de ayuda ("Click en un voto para usarlo como puntuación final") solo cuando `isModerator()` es `true`
- [x] 2.6 En `room.html`, pasar `[isModerator]` a `app-reveal-panel` y conectar `(resolveVote)` a `resolveWith($event)`
- [x] 2.7 Eliminar el bloque `room__manual-score` (input + botón "Usar valor manual") de `room.html`
- [x] 2.8 Eliminar la propiedad `manualScore` y el método `resolveWithManualScore()` de `room.ts`

## 3. Promedio y moda: simplificar texto y botones

- [x] 3.1 Eliminar la línea de texto "Promedio: {{ result().average }}" de `reveal-panel.html`
- [x] 3.2 Mantener la línea de texto "Moda: ..." únicamente cuando `result().mode.length > 1`
- [x] 3.3 Mantener en `room.html` el botón de moda condicionado a `mode.length === 1`; cuando hay empate, no se ofrece botón (solo la línea de texto de la task 3.2)

## 4. Nueva ronda dentro de RevealPanel

- [x] 4.1 Agregar `output<void>()` (ej. `newRound`) a `RevealPanel`
- [x] 4.2 Agregar un botón con ícono de refresh en `reveal-panel.html`, ubicado antes de la lista de votos, en la misma fila
- [x] 4.3 Aplicar estilos en `reveal-panel.scss` para el botón (mismo padding/gap que las tarjetas de voto)
- [x] 4.4 En `room.html`, conectar `(newRound)` de `app-reveal-panel` a `newRound()`
- [x] 4.5 Eliminar el botón "Nueva ronda" del bloque `room__resolution` en `room.html`

## 5. Validación

- [x] 5.1 Probar que hacer click en el voto de un participante resuelve la historia con ese valor
- [x] 5.2 Probar que "Aceptar promedio" sigue funcionando sin la línea de texto redundante
- [x] 5.3 Probar el caso de moda con un solo valor (botón visible) y con empate (solo texto, sin botón)
- [x] 5.4 Probar que "Nueva ronda" funciona desde su nueva ubicación dentro de `reveal-panel`
- [x] 5.5 Confirmar que la fase `revealed` ya no ofrece definir la próxima historia, y que esa opción reaparece correctamente en `room__current-story` tras resolver
