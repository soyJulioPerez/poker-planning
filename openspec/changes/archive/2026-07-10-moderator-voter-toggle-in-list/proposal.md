## Why

El control "Quiero votar como moderador" es hoy un checkbox de texto suelto, ubicado en `room.html` debajo de toda la lista de participantes (`app-participant-list`), desconectado visualmente de la fila donde aparece el propio nombre del moderador. Además, es un checkbox nativo sin estilo, inconsistente con el resto de indicadores visuales de la app (badges, íconos).

## What Changes

- Mover el control de "¿el moderador vota?" desde `room.html` hacia adentro de `app-participant-list`, mostrándolo inline en la fila del moderador.
- Reemplazar el checkbox nativo por un switch estilizado tipo pill (toggle on/off).
- El switch es visible para **todos** los participantes en la fila del moderador (mostrando si vota o no), pero solo es interactivo para el propio moderador; para el resto de los participantes aparece deshabilitado/de solo lectura.
- Se mantiene la regla existente: el estado solo puede cambiarse cuando no hay una ronda de votación activa (`roundPhase === 'idle'`); durante una ronda activa, el switch se muestra deshabilitado incluso para el propio moderador.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `room-management`: el requisito "Moderador como votante opcional" se actualiza para reflejar que el control para cambiar esta condición se ubica junto al nombre del moderador en la lista de participantes (visible para todos, interactivo solo para el moderador), en vez de ser un control aparte solo visible para el moderador.

## Impact

- Código afectado: [apps/web/src/app/ui/participant-list/participant-list.ts](apps/web/src/app/ui/participant-list/participant-list.ts), [apps/web/src/app/ui/participant-list/participant-list.html](apps/web/src/app/ui/participant-list/participant-list.html), [apps/web/src/app/ui/participant-list/participant-list.scss](apps/web/src/app/ui/participant-list/participant-list.scss), [apps/web/src/app/pages/room/room.html](apps/web/src/app/pages/room/room.html) (se elimina el bloque de checkbox suelto y se pasan nuevos inputs/se conecta el nuevo output a `app-participant-list`).
- No afecta backend ni `shared-contracts`; la acción `setModeratorIsVoter` ya existe y se reutiliza sin cambios.
- `ParticipantList` deja de ser puramente presentacional (gana inputs de contexto del viewer y un output de interacción), pero mantiene su responsabilidad de mostrar la lista.
