## Why

Cuando el moderador resuelve una historia (`resolveStory`), el sistema resetea de inmediato `currentStoryTitle` a `null` y `roundPhase` a `'idle'`. El único mensaje que ven los participantes en ese momento es "Esperando a que el moderador defina la historia a estimar", sin ninguna confirmación de qué valor quedó asignado a la historia recién cerrada. Ese detalle solo es visible en el resumen final de la sesión, al cerrar la sala.

## What Changes

- Exponer en el tipo `Room` (`shared-contracts`) un nuevo campo `lastResolvedStory: ResolvedStory | null`, calculado como la última historia resuelta de la sala (o `null` si todavía no se resolvió ninguna).
- En `room.html`, cuando no hay `currentStoryTitle` (estado de espera), mostrar encima del mensaje "Esperando a que el moderador defina la historia a estimar" un texto con el resultado de `lastResolvedStory` (título y puntaje), si existe. El mensaje de espera no se modifica ni se reemplaza; ambos coexisten.
- Sin lógica adicional de "limpieza": en cuanto el moderador define el título de la próxima historia, todo este bloque deja de renderizarse automáticamente porque pasa a mostrarse la sección de historia actual/votación en su lugar.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `estimation-session`: se agrega, al requisito de avance de historia, la exigencia de mostrar el resultado de la última historia resuelta mientras no haya una nueva historia asignada.

## Impact

- Código afectado: [packages/shared-contracts/src/lib/domain.ts](packages/shared-contracts/src/lib/domain.ts) (tipo `Room`), [apps/realtime-api/src/lib/room-repository.ts](apps/realtime-api/src/lib/room-repository.ts) (`buildRoomState`), [apps/web/src/app/pages/room/room.html](apps/web/src/app/pages/room/room.html).
- No afecta acciones existentes (`resolveStory`, `nextStory`) ni el resumen final de sesión (`roomSummary`), que sigue funcionando igual.
- Cambio de protocolo: `Room` gana un campo nuevo; no es breaking porque es aditivo (clientes existentes que no lo lean simplemente lo ignoran).
