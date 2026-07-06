## 1. Sección de historia actual

- [x] 1.1 Sacar el título de la historia actual del `<header>` en `room.html`
- [x] 1.2 Crear una sección propia para el título de la historia, ubicada entre el header y el resto del contenido
- [x] 1.3 Ajustar estilos en `room.scss` para la nueva sección

## 2. Reordenar "Votá tu estimación" y "Participantes"

- [x] 2.1 Mover la sección `room__voting` (solo el `app-voting-board`) para que aparezca antes que `room__participants`
- [x] 2.2 Mover `voteProgress()` ("N de M votaron") y el botón "Revelar votos" desde `room__voting` hacia `room__participants`
- [x] 2.3 Confirmar que el bloque de `roundPhase === 'revealed'` (reveal-panel, resolución) no se ve afectado por el reordenamiento
- [x] 2.4 Ajustar estilos en `room.scss` según corresponda tras mover los elementos

## 3. Regla: no votar sin historia asignada

- [x] 3.1 En `apps/realtime-api/src/actions/vote.ts` (`handleVote`), rechazar el voto con un mensaje de error si `meta.currentStoryTitle` es `null`
- [x] 3.2 En `room.html`, ocultar o deshabilitar el `app-voting-board` cuando `currentRoom.currentStoryTitle` no tiene valor

## 4. Validación

- [x] 4.1 Probar visualmente el nuevo orden de secciones durante una ronda de votación activa
- [x] 4.2 Probar que no se puede votar en una sala recién creada sin historia asignada (UI y, si es posible, intento directo vía backend)
- [x] 4.3 Probar que, tras asignar una historia, la votación funciona con normalidad
- [x] 4.4 Confirmar que el flujo de `roundPhase === 'revealed'` sigue funcionando sin cambios
