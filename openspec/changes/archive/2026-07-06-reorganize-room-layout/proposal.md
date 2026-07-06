## Why

En la pantalla de sala, la acción principal del votante ("Votá tu estimación") aparece tercera en el flujo vertical, después del header y de la lista completa de participantes, obligando a scrollear más de lo necesario. Además, el progreso de votación y el botón "Revelar votos" están junto a las cartas en vez de junto a la lista de participantes, cuando en la práctica el moderador necesita ver quién falta votar justo al lado del botón para decidir cuándo revelar. Por último, hoy es posible votar en una sala que todavía no tiene una historia con título asignada, lo cual no tiene sentido de negocio (no hay nada que se esté estimando).

## What Changes

- Extraer el título de la historia actual del `<header>` de `room.html` y darle su propia sección destacada, ubicada inmediatamente debajo del header.
- Reordenar la sección "Votá tu estimación" para que aparezca antes que "Participantes", y que contenga únicamente el `app-voting-board` (las cartas), sin el progreso de voto ni el botón de revelar.
- Mover el progreso de voto ("N de M votaron") y el botón "Revelar votos" a la sección "Participantes".
- Estos cambios de layout aplican solo durante la fase de votación activa (`roundPhase !== 'revealed'`); el bloque de resultados/resolución que se muestra cuando `roundPhase === 'revealed'` (reveal-panel, aceptar promedio/moda/manual, nueva ronda, siguiente historia) no se modifica en este cambio.
- **Nueva regla de negocio**: no se permite votar mientras la historia actual no tenga título (`currentStoryTitle` es `null`). En el frontend, se oculta o deshabilita el `voting-board` en ese caso. En el backend, `handleVote` (`apps/realtime-api/src/actions/vote.ts`) rechaza el voto si `meta.currentStoryTitle` es `null`, devolviendo un mensaje de error al conector, siguiendo el mismo patrón ya usado para "Room not found".

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `estimation-session`: se agrega un nuevo requisito que exige que exista una historia con título asignado como precondición para poder votar.

## Impact

- Código afectado: [apps/web/src/app/pages/room/room.html](apps/web/src/app/pages/room/room.html), [apps/web/src/app/pages/room/room.scss](apps/web/src/app/pages/room/room.scss), [apps/web/src/app/pages/room/room.ts](apps/web/src/app/pages/room/room.ts) (posible ajuste si hace falta exponer una condición de "hay historia"), y [apps/realtime-api/src/actions/vote.ts](apps/realtime-api/src/actions/vote.ts).
- No afecta `shared-contracts` (no se agregan campos nuevos al protocolo, solo se valida un campo existente).
- Cambia comportamiento observable: intentos de voto sin historia asignada ahora son rechazados por el backend, y la UI ya no ofrece la opción de votar en ese estado.
