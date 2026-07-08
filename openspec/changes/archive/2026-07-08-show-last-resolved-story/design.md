## Context

`Room` (en `packages/shared-contracts/src/lib/domain.ts`) es el tipo compartido entre backend y frontend que viaja por WebSocket. Hoy expone `storiesEstimatedCount` y `accumulatedScore` (agregados numéricos), pero no el detalle de qué historia se resolvió con qué puntaje — eso solo existe en `RoomSummary` (`resolvedStories` completo), enviado únicamente al cerrar la sala (`close-room.ts`). `buildRoomState` en `apps/realtime-api/src/lib/room-repository.ts` ya tiene acceso a `meta.resolvedStories: ResolvedStory[]` al construir el estado de sala.

## Goals / Non-Goals

**Goals:**
- Dar visibilidad inmediata del resultado de la última historia resuelta, sin esperar al resumen final de sesión.
- Mantener el cambio acotado: solo el último resultado, no un historial completo.

**Non-Goals:**
- No se expone la lista completa `resolvedStories` en `Room` (eso sería la idea de "historial visible en la sala", descartada a favor de este enfoque más simple).
- No se agrega ningún mecanismo de auto-ocultamiento por tiempo (el bloque desaparece naturalmente cuando se asigna una nueva historia, no por un timeout).
- No se modifica `RoomSummary` ni el flujo de cierre de sala.

## Decisions

- **Nuevo campo `lastResolvedStory: ResolvedStory | null` en `Room`**: se calcula en `buildRoomState` como `meta.resolvedStories.at(-1) ?? null`. Se reutiliza el tipo `ResolvedStory` ya existente (`{ title, finalScore }`) en vez de crear uno nuevo, ya que la forma del dato es idéntica a la que ya usa `RoomSummary`.
- **Ubicación en el frontend**: el nuevo texto se agrega dentro del mismo bloque `@else` de `room.html` que hoy renderiza el mensaje de espera (cuando `currentStoryTitle` es `null`), como un elemento adicional antes del mensaje existente, sin alterar su condición ni contenido.
- **Sin lógica de limpieza explícita**: no se necesita "borrar" `lastResolvedStory` al iniciar una nueva historia — el bloque completo dentro del cual se muestra ya está condicionado a `!currentStoryTitle`, así que deja de renderizarse solo por la estructura de control existente.

## Risks / Trade-offs

- [Campo adicional en `Room`] → mínimo, es aditivo y no rompe clientes existentes que no lo lean.
- [`maskRoomForViewer`] → verificar que esta función (que oculta votos según el viewer) no necesite excluir `lastResolvedStory`; al ser información ya pública en el resumen final, no hay razón para ocultarla durante la sesión activa.
