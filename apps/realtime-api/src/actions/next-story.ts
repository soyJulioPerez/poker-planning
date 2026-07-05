import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, connectionKey, roomKey } from '../lib/dynamo-client';
import { getRoomMeta, buildRoomState, maskRoomForViewer } from '../lib/room-repository';
import { broadcastRoomState, sendToConnection } from '../lib/broadcast';
import { resetVotes } from '../lib/reset-votes';
import { NextStoryRequest } from 'shared-contracts';

export async function handleNextStory(
  apiEndpoint: string,
  connectionId: string,
  request: NextStoryRequest
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
      message: 'Only the moderator can advance to the next story',
    });
    return;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: roomKey(request.roomId),
      UpdateExpression:
        'SET currentStoryTitle = :title, roundPhase = :idle, revealResult = :null',
      ExpressionAttributeValues: {
        ':title': request.storyTitle,
        ':idle': 'idle',
        ':null': null,
      },
    })
  );

  await resetVotes(request.roomId);

  const room = await buildRoomState(request.roomId);
  if (room) {
    await broadcastRoomState(apiEndpoint, room, maskRoomForViewer);
  }
}
