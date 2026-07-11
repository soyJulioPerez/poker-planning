## Why

Hoy todos los participantes de una sala se distinguen únicamente por su nombre en `ParticipantList`; no hay ninguna identidad visual propia. Un grupo de íconos/avatares opcional, elegido por el moderador al crear la sala, le da a cada participante un ícono distintivo (además del ya existente 🧙 de moderador), haciendo la lista más fácil de reconocer de un vistazo sin romper la unicidad por nombre que ya usa el sistema.

## What Changes

- Se agrega el concepto de `IconGroup` (catálogo de emojis por temática), paralelo a `DeckOption`, en `shared-contracts`.
- Catálogo inicial de 3 grupos: **Hobbies**, **Emociones**, **Animales** (cada uno ~12 emojis).
- Al crear una sala, el moderador puede elegir un grupo de íconos o dejarlo en "Ninguno" (comportamiento actual, sin cambios).
- Si la sala tiene un grupo asignado (`iconGroupId` no nulo):
  - El formulario de "Unirse a sala" muestra una grilla para elegir un ícono del grupo (obligatorio si el grupo está activo).
  - El moderador también elige su ícono en el formulario de "Crear sala".
  - El ícono elegido se muestra a la izquierda del nombre en `ParticipantList`. Para el moderador, se muestran ambos íconos (🧙 seguido del avatar elegido) antes del nombre.
- Si la sala no tiene grupo asignado, no aparece ningún selector de ícono y `ParticipantList` se comporta igual que hoy.
- Dos participantes pueden elegir el mismo ícono; el nombre sigue siendo el identificador único para unicidad y reconexión (sin cambios en esa lógica).

## Capabilities

### New Capabilities
- `participant-identity`: catálogo de grupos de íconos, selección de ícono al unirse/crear sala, y visualización del ícono junto al nombre en la lista de participantes.

### Modified Capabilities
- `room-management`: la creación de sala gana un campo opcional de grupo de íconos; la unión a sala gana un campo opcional (condicional) de ícono; el "Rol de moderador único" ahora convive con el ícono de avatar elegido.

## Impact

- `packages/shared-contracts`: nuevo tipo `IconGroup`, catálogo `AVAILABLE_ICON_GROUPS`, campo `Room.iconGroupId: string | null`, campo `Participant.icon: string | null`.
- `apps/realtime-api`: mensajes de creación de sala y unión a sala deben aceptar/propagar `iconGroupId` e `icon`; almacenamiento de sala/participante extiende sus campos.
- `apps/web`: formularios de "Crear sala" y "Unirse a sala" (selector de grupo + grilla de íconos), `ParticipantList` (pintado del ícono junto al nombre, combinado con el badge de moderador existente).
