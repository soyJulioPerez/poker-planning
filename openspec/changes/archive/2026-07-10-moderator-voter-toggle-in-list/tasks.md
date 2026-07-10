## 1. ParticipantList: nuevos inputs y output

- [x] 1.1 Agregar `input<boolean>()` `isModerator` a `ParticipantList` (¿el viewer actual es moderador?)
- [x] 1.2 Agregar `input<boolean>()` `canChangeVoterStatus` a `ParticipantList` (equivalente a `roundPhase === 'idle'`)
- [x] 1.3 Agregar `output<boolean>()` `moderatorIsVoterChange` a `ParticipantList`

## 2. Switch inline en la fila del moderador

- [x] 2.1 En `participant-list.html`, agregar el switch (checkbox nativo estilizado) en la fila donde `participant.isModerator` es verdadero
- [x] 2.2 El estado visual del switch refleja `participant.isVoter`
- [x] 2.3 El switch está deshabilitado cuando `!isModerator()` (otros participantes) o `!canChangeVoterStatus()` (ronda activa, incluso para el propio moderador)
- [x] 2.4 Al interactuar (solo si es interactivo), emitir `moderatorIsVoterChange` con el nuevo valor
- [x] 2.5 Agregar `title`/tooltip indicando "Solo el moderador puede cambiar esto" cuando el control está deshabilitado por no ser moderador

## 3. Estilos del switch tipo pill

- [x] 3.1 En `participant-list.scss`, estilizar el checkbox nativo como un switch pill (track + thumb deslizante)
- [x] 3.2 Aplicar estado visual deshabilitado (opacidad reducida, cursor not-allowed)

## 4. Conectar RoomPage

- [x] 4.1 En `room.html`, pasar `[isModerator]` y `[canChangeVoterStatus]` a `app-participant-list`, y conectar `(moderatorIsVoterChange)` a `setModeratorIsVoter($event)`
- [x] 4.2 Eliminar el bloque `<label class="room__moderator-toggle">` y su checkbox de `room.html`
- [x] 4.3 Eliminar los estilos `room__moderator-toggle` de `room.scss` si quedan sin uso

## 5. Validación

- [x] 5.1 Probar que el moderador puede alternar el switch cuando no hay ronda activa
- [x] 5.2 Probar que el switch aparece deshabilitado para el moderador durante una ronda activa
- [x] 5.3 Probar que otros participantes ven el switch en estado deshabilitado, reflejando el valor actual
- [x] 5.4 Confirmar que el cambio de estado sigue afectando correctamente si el moderador puede votar en la siguiente ronda
