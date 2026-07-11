## Why

Se detectó, durante pruebas manuales con el mazo "Fibonacci con manos", que el moderador podía aceptar la moda como puntuación final de una historia aunque el único valor de moda fuera un símbolo no numérico ("☕", "🧉" o "?"). El botón "Aceptar moda" solo validaba `mode.length === 1`, sin comprobar que ese valor fuera parseable como número, y el servidor tampoco rechazaba un `finalScore` no finito (`NaN`).

## What Changes

- El botón "Aceptar moda" en `room.html` ahora solo se muestra cuando el único valor de moda es numérico (se agrega `modeAsNumber()` en `room.ts`, análogo al `voteAsNumber()` ya existente en `reveal-panel.ts`).
- `handleResolveStory` en el servidor rechaza la acción con un mensaje de error si `finalScore` no es un número finito, como defensa adicional independiente de la UI.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `estimation-session`: el requirement "Resolución manual de la historia" se aclara para excluir explícitamente los valores de moda no numéricos como aceptables.

## Impact

- `apps/web/src/app/pages/room/room.ts` y `room.html`
- `apps/realtime-api/src/actions/resolve-story.ts`
