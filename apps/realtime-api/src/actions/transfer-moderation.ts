import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, connectionKey } from '../lib/dynamo-client';
import { getRoomMeta, getRoomParticipants, buildRoomState, maskRoomForViewer } from '../lib/room-repository';
import { broadcastRoomState, sendToConnection } from '../lib/broadcast';
import { commitModerationChange } from '../lib/moderation-change';
import { TransferModerationRequest } from 'shared-contracts';

export async function handleTransferModeration(
  apiEndpoint: string,
  connectionId: string,
  request: TransferModerationRequest
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
      message: 'Only the moderator can transfer moderation',
    });
    return;
  }

  if (request.targetName === name) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Cannot transfer moderation to yourself',
    });
    return;
  }

  const participants = await getRoomParticipants(request.roomId);
  const target = participants.find((p) => p.name === request.targetName);
  if (!target?.connected) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Moderation can only be transferred to a connected participant',
    });
    return;
  }

  // La ronda (fase, historia, votos) no se toca: cambia quién la conduce, no la ronda.
  const committed = await commitModerationChange({
    roomId: request.roomId,
    previousModerator: name,
    nextModerator: request.targetName,
  });
  if (!committed) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Moderation could not be transferred',
    });
    return;
  }

  const room = await buildRoomState(request.roomId);
  if (room) {
    await broadcastRoomState(apiEndpoint, room, maskRoomForViewer);
  }
}
