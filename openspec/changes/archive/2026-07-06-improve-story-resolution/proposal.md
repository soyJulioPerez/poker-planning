## Why

La sección de resolución tras revelar los votos (`roundPhase === 'revealed'`) mezcla demasiadas opciones sin jerarquía clara: promedio y moda se repiten en texto y en botón, existe una opción de "valor manual" poco usada que en la práctica reemplaza la intención real del moderador (usar el voto de un participante puntual como puntuación), el botón "Nueva ronda" está desconectado visualmente de los votos que reinicia, y se ofrece definir la próxima historia antes incluso de haber resuelto la actual.

## What Changes

- Eliminar de la fase `revealed` el bloque para definir la próxima historia (input + botón "Siguiente historia"); esa acción ya está disponible en la sección de historia actual una vez que la ronda vuelve a `idle` tras resolver.
- Reemplazar la opción "Usar valor manual" (input numérico + botón) por la posibilidad de hacer click directamente sobre el voto de un participante en `app-reveal-panel` para usarlo como puntuación final de la historia. Se agrega un texto de ayuda visible solo para el moderador indicando que los votos son clickeables.
- Eliminar la línea de texto "Promedio: X" (redundante con el botón "Aceptar promedio (X)"). La línea "Moda: ..." se mantiene únicamente cuando hay empate entre varios valores, y en ese caso se ofrece un botón "Aceptar moda (X)" por cada valor empatado.
- Mover el botón "Nueva ronda" para que quede dentro de `app-reveal-panel`, a la izquierda de la fila de votos, con un ícono de refresh.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `estimation-session`: el requisito "Resolución manual de la historia" cambia — se elimina la posibilidad de ingresar un valor numérico arbitrario, reemplazada por la posibilidad de seleccionar el voto de un participante puntual como puntuación final.

## Impact

- Código afectado: [apps/web/src/app/pages/room/room.html](apps/web/src/app/pages/room/room.html), [apps/web/src/app/pages/room/room.ts](apps/web/src/app/pages/room/room.ts), [apps/web/src/app/ui/reveal-panel/reveal-panel.html](apps/web/src/app/ui/reveal-panel/reveal-panel.html), [apps/web/src/app/ui/reveal-panel/reveal-panel.ts](apps/web/src/app/ui/reveal-panel/reveal-panel.ts), [apps/web/src/app/ui/reveal-panel/reveal-panel.scss](apps/web/src/app/ui/reveal-panel/reveal-panel.scss).
- No afecta el backend (`resolveStory` ya acepta cualquier `finalScore` numérico; seleccionar el voto de un participante simplemente reutiliza ese mismo mensaje con el valor de su voto) ni `shared-contracts`.
- **BREAKING** (de cara al usuario, no técnico): se elimina la capacidad de ingresar manualmente cualquier valor numérico como puntuación final; solo se puede elegir promedio, moda, o el voto de un participante existente.
