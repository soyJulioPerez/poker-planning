import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, participantKey, connectionKey, nowPlusTtl } from '../lib/dynamo-client';
import { getRoomMeta, getRoomParticipants, buildRoomState, maskRoomForViewer } from '../lib/room-repository';
import { broadcastRoomState, sendToConnection } from '../lib/broadcast';
import { AVAILABLE_ICON_GROUPS, JoinRoomRequest } from 'shared-contracts';

export async function handleJoinRoom(
  apiEndpoint: string,
  connectionId: string,
  request: JoinRoomRequest
): Promise<void> {
  const meta = await getRoomMeta(request.roomId);
  if (!meta) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'joinRejected',
      reason: 'room-not-found',
    });
    return;
  }

  const participants = await getRoomParticipants(request.roomId);
  const existing = participants.find((p) => p.name === request.name);

  if (existing && existing.connected) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'joinRejected',
      reason: 'name-taken',
    });
    return;
  }

  const ttl = nowPlusTtl();

  const iconGroup = meta.iconGroupId
    ? AVAILABLE_ICON_GROUPS.find((group) => group.id === meta.iconGroupId)
    : undefined;
  const icon =
    existing?.icon ??
    (iconGroup && request.icon && iconGroup.icons.includes(request.icon) ? request.icon : null);

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...participantKey(request.roomId, request.name),
        name: request.name,
        connectionId,
        isModerator: existing?.isModerator ?? false,
        isVoter: existing?.isVoter ?? true,
        connected: true,
        vote: existing?.vote ?? null,
        icon,
        ttl,
      },
    })
  );

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: connectionKey(connectionId),
      UpdateExpression: 'SET roomId = :roomId, #name = :name',
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: { ':roomId': request.roomId, ':name': request.name },
    })
  );

  const room = await buildRoomState(request.roomId);
  if (room) {
    await broadcastRoomState(apiEndpoint, room, maskRoomForViewer);
  }
}
