import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, connectionKey, participantKey } from '../lib/dynamo-client';
import { getRoomMeta, buildRoomState, maskRoomForViewer } from '../lib/room-repository';
import { broadcastRoomState, sendToConnection } from '../lib/broadcast';
import { VoteRequest } from 'shared-contracts';

export async function handleVote(
  apiEndpoint: string,
  connectionId: string,
  request: VoteRequest
): Promise<void> {
  const connection = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: connectionKey(connectionId) })
  );
  const name = connection.Item?.['name'] as string | undefined;
  if (!name) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Not joined to a room',
    });
    return;
  }

  const meta = await getRoomMeta(request.roomId);
  if (!meta) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Room not found',
    });
    return;
  }

  if (!meta.currentStoryTitle) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'No story assigned yet',
    });
    return;
  }

  // Las dos guardas de abajo las cumple también la interfaz —el mazo no se pinta con la
  // ronda revelada, y va `disabled` para quien no es votante—, pero el servidor no puede
  // depender de eso: un cliente desactualizado, una reconexión con estado desfasado o una
  // regresión en la web vuelven a abrir el camino. Es el mismo criterio que el change
  // `2026-07-11-fix-mode-numeric-only` aplicó al puntaje final.

  // Va antes que la de `isVoter` a propósito: se resuelve con lo que ya se leyó, sin
  // pagar una consulta más.
  if (meta.roundPhase === 'revealed') {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Voting is closed for this round',
    });
    return;
  }

  const participant = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: participantKey(request.roomId, name) })
  );
  if (participant.Item?.['isVoter'] === false) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Only participants marked as voters can vote',
    });
    return;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: participantKey(request.roomId, name),
      UpdateExpression: 'SET vote = :vote',
      ExpressionAttributeValues: { ':vote': request.value },
    })
  );

  if (meta.roundPhase === 'idle') {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `ROOM#${request.roomId}`, SK: 'META' },
        UpdateExpression: 'SET roundPhase = :voting',
        ExpressionAttributeValues: { ':voting': 'voting' },
      })
    );
  }

  const room = await buildRoomState(request.roomId);
  if (room) {
    await broadcastRoomState(apiEndpoint, room, maskRoomForViewer);
  }
}
