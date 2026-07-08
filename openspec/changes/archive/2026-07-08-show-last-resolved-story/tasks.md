## 1. Backend: exponer la última historia resuelta

- [x] 1.1 Agregar `lastResolvedStory: ResolvedStory | null` al tipo `Room` en `packages/shared-contracts/src/lib/domain.ts`
- [x] 1.2 Calcular `lastResolvedStory` en `buildRoomState` (`apps/realtime-api/src/lib/room-repository.ts`) como `meta.resolvedStories.at(-1) ?? null`
- [x] 1.3 Verificar que `maskRoomForViewer` no oculte indebidamente este campo (no debería requerir cambios, ya que no expone información sensible)
- [x] 1.4 Completar `lastResolvedStory: null` en la construcción manual de `Room` en `handleCreateRoom` (`apps/realtime-api/src/actions/create-room.ts`), detectado por error de compilación TS2741

## 2. Frontend: mostrar el resultado junto al mensaje de espera

- [x] 2.1 En `room.html`, dentro del bloque que muestra "Esperando a que el moderador defina la historia a estimar", agregar un texto condicional (`@if (currentRoom.lastResolvedStory)`) con el título y puntaje de la última historia resuelta
- [x] 2.2 Confirmar que el mensaje de espera existente no cambia su condición ni contenido

## 3. Validación

- [x] 3.1 Probar que, tras resolver una historia, aparece su resultado junto al mensaje de espera
- [x] 3.2 Probar que, al definir la siguiente historia, el bloque de resultado anterior desaparece junto con el mensaje de espera
- [x] 3.3 Probar que en una sala recién creada (sin ninguna historia resuelta todavía) no se muestra ningún resultado previo
- [x] 3.4 Confirmar que el resumen final de sesión (`roomSummary`) sigue funcionando sin cambios
