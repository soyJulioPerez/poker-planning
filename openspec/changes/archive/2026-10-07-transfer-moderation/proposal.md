## Why

Hoy el rol de moderador queda atado para siempre a quien creó la sala: si el moderador tiene que irse, o se le cae la conexión y no vuelve, nadie más puede revelar votos, resolver historias ni iniciar rondas, y la sesión de estimación queda trabada. El requisito "Rol de moderador único" prohíbe explícitamente la transferencia; este change lo levanta de forma controlada.

## What Changes

- El moderador puede **ceder** la moderación a cualquier otro participante conectado, de forma directa (sin que el receptor tenga que aceptar), en cualquier momento de la ronda.
- Cualquier participante conectado puede **tomar** la moderación cuando el moderador lleva al menos 60 segundos desconectado. Si varios lo intentan a la vez, gana el primero; el resto recibe un rechazo.
- Ceder o tomar la moderación no altera la ronda en curso: fase, historia actual y votos quedan intactos.
- Tras el cambio, el moderador anterior queda como participante común, y tanto él como el nuevo moderador quedan con su condición de votante encendida. El nuevo moderador puede apagarla luego con el control existente ("el moderador vota"), con las mismas reglas de hoy.
- Si el moderador anterior reingresa, vuelve como participante común; no recupera el rol automáticamente.
- Quien **recibe** la moderación cedida ve un aviso temporal ("Ahora sos el moderador"), anunciado a lectores de pantalla. Quien la **toma** por su cuenta no ve el aviso.
- El servidor pasa a registrar el momento de desconexión de cada participante, y lo expone en el estado de la sala para que el cliente sepa cuándo habilitar "Tomar moderación".

Fuera de alcance:
- El agujero existente por el cual alguien que entra con el nombre de un moderador desconectado hereda el rol (identidad por nombre). Se mantiene como está.
- La UI de la app mobile: hereda el cambio de protocolo vía `shared-contracts`/`room-client-runtime`, pero sus pantallas no ganan los controles de ceder/tomar en este change.

## Capabilities

### New Capabilities

(ninguna — el cambio se resuelve dentro de capabilities existentes)

### Modified Capabilities

- `room-management`: el requirement "Rol de moderador único" deja de prohibir la transferencia — el rol sigue siendo único, pero puede cederse o tomarse. Se agregan requirements para ceder la moderación, tomarla ante desconexión prolongada del moderador, y el aviso al receptor.

## Impact

- `packages/shared-contracts`: nuevos requests `TransferModerationRequest` y `ClaimModerationRequest`; `Participant` gana `disconnectedAt: number | null`.
- `apps/realtime-api`: nuevas acciones `transfer-moderation.ts` y `claim-moderation.ts`, ruteadas en `handlers/default.ts` y en `main.ts` (servidor local). El handler de `$disconnect` (`handlers/disconnect.ts` y `handleDisconnect` en `main.ts`) guarda `disconnectedAt`; `join-room.ts` lo limpia al reingresar. `room-repository.ts` expone el campo nuevo.
- `apps/web`: `participant-list` gana un menú de acciones ⋮ con "Hacer moderador" (visible solo para el moderador, por cada participante conectado) y muestra al moderador en la primera fila y "Tomar moderación" (visible para todos cuando el moderador lleva ≥ 60 s desconectado). `room.ts` envía las acciones nuevas y muestra el aviso al receptor; se agrega un componente de aviso temporal con `aria-live`, que hoy no existe en la web.
- Infra: no requiere cambios — las acciones nuevas entran por la ruta `$default` ya existente, y `DynamoDBCrudPolicy` ya cubre las acciones subyacentes (`UpdateItem`, `ConditionCheckItem`) que autorizan un `TransactWriteItems`.
- Salas activas al momento del deploy: participantes desconectados antes del deploy no tienen `disconnectedAt`; se tratan como "desconectado sin marca de tiempo" (ver design).
