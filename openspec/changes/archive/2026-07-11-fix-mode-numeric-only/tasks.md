## 1. Frontend

- [x] 1.1 Agregar `modeAsNumber(mode: string[]): number | null` en `apps/web/src/app/pages/room/room.ts`, que retorna `null` si `mode.length !== 1` o si el único valor no es un número finito
- [x] 1.2 Actualizar el `@if` del botón "Aceptar moda" en `room.html` para usar `modeAsNumber(...)` en vez de `mode.length === 1`, pasando el valor numérico ya resuelto a `resolveWith(...)`

## 2. Backend

- [x] 2.1 Agregar validación en `handleResolveStory` (`apps/realtime-api/src/actions/resolve-story.ts`) que rechaza la acción con un mensaje de error si `request.finalScore` no es `Number.isFinite`

## 3. Validación manual

- [x] 3.1 Con 3 participantes, votar 2 con "☕"/"🧉" (mismo símbolo) y 1 con un número; confirmar que el botón "Aceptar moda" NO aparece, ya que el único valor de moda no es numérico
- [x] 3.2 Confirmar que el botón "Aceptar moda" sigue apareciendo normalmente cuando el único valor de moda es numérico
