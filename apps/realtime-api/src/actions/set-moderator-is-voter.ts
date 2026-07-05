import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, connectionKey, roomKey, participantKey } from '../lib/dynamo-client';
import { getRoomMeta, buildRoomState, maskRoomForViewer } from '../lib/room-repository';
import { broadcastRoomState, sendToConnection } from '../lib/broadcast';
import { SetModeratorIsVoterRequest } from 'shared-contracts';

export async function handleSetModeratorIsVoter(
  apiEndpoint: string,
  connectionId: string,
  request: SetModeratorIsVoterRequest
): Promise<void> {
  const connection = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: connectionKey(connectionId) })
  );
  const name = connection.Item?.['name'] as string | undefined;

  const meta = await getRoomMeta(request.roomId);
  if (!meta) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Room not found',
    });
    return;
  }

  if (name !== meta.moderatorName) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Only the moderator can change this setting',
    });
    return;
  }

  if (meta.roundPhase !== 'idle') {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Cannot change voter status while a round is active',
    });
    return;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: roomKey(request.roomId),
      UpdateExpression: 'SET moderatorIsVoter = :isVoter',
      ExpressionAttributeValues: { ':isVoter': request.isVoter },
    })
  );

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: participantKey(request.roomId, meta.moderatorName),
      UpdateExpression: 'SET isVoter = :isVoter',
      ExpressionAttributeValues: { ':isVoter': request.isVoter },
    })
  );

  const room = await buildRoomState(request.roomId);
  if (room) {
    await broadcastRoomState(apiEndpoint, room, maskRoomForViewer);
  }
}
