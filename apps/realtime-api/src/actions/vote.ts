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
