## Why

Hoy la app no ofrece ninguna orientación sobre cómo usar Planning Poker bien: quien participa por primera vez no tiene dónde aprender la mecánica básica (por qué se vota en secreto, qué significan "?" y "☕"), quien modera no tiene guía sobre cómo manejar dispersión de votos o cuándo revelar, y equipos ya experimentados tienden a olvidar que el objetivo real de la técnica no es "llegar a un número" sino forzar la conversación que revela desalineación en el entendimiento de la historia. No existe hoy ningún lugar en la app donde capturar y ofrecer ese conocimiento.

## What Changes

- Nuevo botón de ayuda ("?"), fijo y siempre visible (FAB), definido una sola vez en el shell raíz (`app.html`) para que aparezca tanto en Home como en Room sin duplicar el componente.
- Al hacer click, se abre un panel/modal ("Guía de estimación") con contenido estático organizado en una columna scrolleable con tres secciones tituladas:
  - Si sos nuevo en esto (qué es Planning Poker, por qué votar en secreto, qué significan "?" y "☕")
  - Si moderás la sesión (cuándo revelar, qué hacer ante mucha dispersión de votos)
  - Aunque ya lo hagas seguido (recordatorio de que el objetivo es el entendimiento compartido de la historia, no solo el número)
- El modal cierra con click en overlay, click en "✕", o tecla Esc.
- Estilos definidos localmente en los nuevos componentes (sin crear tokens/variables SCSS globales todavía — ver Impact).

## Capabilities

### New Capabilities
- `estimation-help-guide`: botón de ayuda persistente y panel modal con contenido estático de buenas prácticas y estrategias de estimación, organizado por audiencia (nuevos participantes, moderadores, recordatorio de propósito para equipos experimentados).

### Modified Capabilities
(ninguna — no cambia el comportamiento de votación, revelado ni resolución de historias existente)

## Impact

- Nuevos componentes Angular en `apps/web/src/app/ui/`: un botón de ayuda (FAB) y un modal de ayuda.
- `apps/web/src/app/app.html`: se agrega el botón de ayuda junto al `<router-outlet>`.
- No afecta `apps/web/src/app/core/room-socket.service.ts` ni ningún mensaje WebSocket — es contenido puramente estático del lado del cliente, sin llamadas al backend.
- No crea tokens/variables SCSS globales ni resuelve el sistema de temas pendiente de `docs/idea.md`; esa deuda queda registrada por separado en `docs/future-ideas.md` como exploración futura independiente.
