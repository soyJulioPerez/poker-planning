## Context

`ParticipantList` (`apps/web/src/app/ui/participant-list/`) es hoy un componente puramente presentacional: recibe `participants: Participant[]` y renderiza cada fila con nombre, badge de moderador, y estado de voto. El control "Quiero votar como moderador" vive completamente aparte, en `room.html`, como un checkbox condicionado a `isModerator()` (del propio `RoomPage`), con `[disabled]` atado a `roundPhase !== 'idle'` y `(ngModelChange)` conectado a `setModeratorIsVoter()`.

## Goals / Non-Goals

**Goals:**
- Que el control de "el moderador vota" aparezca inline en la fila del moderador dentro de `ParticipantList`.
- Que sea visible para todos los participantes (mostrando el estado actual), pero interactivo solo para el propio moderador.
- Reemplazar el checkbox nativo por un switch estilizado tipo pill.

**Non-Goals:**
- No se cambia la acción `setModeratorIsVoter` del backend ni el protocolo compartido.
- No se agregan controles equivalentes para el estado `isVoter` de participantes no-moderadores (eso no existe hoy y queda fuera de alcance).
- No se rediseña el resto de `ParticipantList` (badge de moderador, indicador de voto) más allá de integrar este nuevo control.

## Decisions

- **`ParticipantList` gana inputs de contexto**: `isModerator: boolean` (¿el viewer actual es moderador?) y `canChangeVoterStatus: boolean` (equivalente a `roundPhase === 'idle'`, calculado en `RoomPage` y pasado como input, para no duplicar esa lógica dentro del componente hijo). Se prefiere pasar `canChangeVoterStatus` ya calculado en vez de pasar `roundPhase` crudo, para mantener `ParticipantList` desacoplado del modelo de fases de ronda.
- **Nuevo output `moderatorIsVoterChange`**: `ParticipantList` emite este evento cuando el propio moderador interactúa con el switch; `RoomPage` lo conecta a `setModeratorIsVoter()`, igual que hace hoy el `(ngModelChange)` del checkbox.
- **Renderizado del switch**: dentro del `@for` de participantes, en la fila donde `participant.isModerator` es verdadero, se agrega el switch. Su estado visual viene de `participant.isVoter` (dato ya presente en `Participant`, no requiere un campo nuevo). Su interactividad (`[disabled]`) depende de `!isModerator() || !canChangeVoterStatus()` — es decir, deshabilitado tanto para quien no es el moderador (view-only) como para el propio moderador durante una ronda activa.
- **Switch estilizado**: se implementa con un `<input type="checkbox">` nativo (para mantener accesibilidad y soporte de teclado) oculto visualmente, estilizado vía CSS como un pill/track con un thumb deslizante — patrón estándar, sin librería externa.
- **Eliminación del bloque en `room.html`**: se remueve el `<label class="room__moderator-toggle">` y su lógica asociada; `RoomPage` sigue exponiendo `setModeratorIsVoter()` pero ya no arma el control directamente.

## Risks / Trade-offs

- [`ParticipantList` deja de ser puramente presentacional] → gana una dependencia de contexto del viewer (quién soy, puedo interactuar). Mitigación: se mantiene acotado a inputs/outputs explícitos, sin inyectar servicios dentro del componente; sigue siendo testeable de forma aislada.
- [Switch visible para todos como "solo lectura"] → alguien podría intentar interactuar y no entender por qué está deshabilitado. Mitigación: usar `title`/tooltip nativo del navegador indicando "Solo el moderador puede cambiar esto" cuando `!isModerator()`.
