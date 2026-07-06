## Context

`room.html` organiza hoy la pantalla de sala en tres secciones verticales: header (con el título de la historia embebido como una línea secundaria), `room__participants` (lista + toggle de moderador), y `room__voting` (que contiene tanto el voting-board como, condicionalmente, el progreso de voto/botón de revelar o el panel de resultados). El backend (`apps/realtime-api/src/actions/vote.ts`, función `handleVote`) no valida hoy si la sala tiene una historia asignada antes de aceptar un voto; solo valida que el participante esté unido y que la sala exista.

## Goals / Non-Goals

**Goals:**
- Priorizar la acción de votar en el flujo vertical de la pantalla, reduciendo el scroll necesario para llegar a las cartas.
- Ubicar el progreso de voto y el botón de revelar junto a la lista de participantes, ya que el moderador consulta ambos juntos para decidir cuándo revelar.
- Impedir votar cuando no hay una historia con título asignado, tanto en la UI como en el servidor.

**Non-Goals:**
- No se modifica el bloque de resultados/resolución (`roundPhase === 'revealed'`): reveal-panel, aceptar promedio/moda/manual, nueva ronda, siguiente historia. Se aborda en un cambio futuro.
- No se rediseña a un layout de múltiples columnas; se mantiene una sola columna vertical, solo se reordenan las secciones existentes.
- No se agregan nuevos mensajes de protocolo a `shared-contracts`; se reutiliza el mecanismo de error existente (`{ type: 'error', message: ... }`).

## Decisions

- **Reordenamiento de secciones**: mover el título de la historia a una sección propia entre el header y el resto del contenido; mover `voteProgress()` y el botón "Revelar votos" de `room__voting` a `room__participants`. Ambos son cambios de template/estilo únicamente — no requieren tocar `room.ts` salvo, potencialmente, reorganizar el orden de las expresiones ya existentes.
- **Guardia de "no votar sin historia"**: se agrega la validación en el backend (`handleVote`), rechazando con `{ type: 'error', message: 'No story assigned yet' }` (o mensaje equivalente) si `meta.currentStoryTitle` es `null`, replicando el patrón ya usado para `'Room not found'`. Se elige rechazar en el backend (fuente de verdad) en vez de confiar solo en el frontend, para que la regla se cumpla incluso si un cliente manda el mensaje directamente por WebSocket.
- **Ocultar/deshabilitar en frontend**: en `room.html`, el `app-voting-board` solo se renderiza (o se deshabilita) cuando `currentRoom.currentStoryTitle` tiene valor. Se prefiere esta validación adicional en el cliente para dar feedback inmediato sin esperar el rechazo del servidor, pero el backend sigue siendo quien garantiza la regla.

## Risks / Trade-offs

- [Reordenar el DOM de `room.html`] → riesgo bajo de romper estilos existentes (`room__voting`, `room__participants`) al mover contenido entre secciones. Mitigación: verificar visualmente ambas secciones tras el cambio, ajustando clases SCSS si hace falta.
- [Rechazo de voto en backend] → un cliente con estado desincronizado (cree que hay historia cuando ya no la hay) recibirá un error inesperado. Mitigación: el mensaje de error ya se maneja de forma genérica en el cliente (mismo patrón que otros rechazos existentes).
