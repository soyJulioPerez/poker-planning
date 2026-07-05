import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, connectionKey, roomKey } from '../lib/dynamo-client';
import { getRoomMeta, buildRoomState, maskRoomForViewer } from '../lib/room-repository';
import { broadcastRoomState, sendToConnection } from '../lib/broadcast';
import { resetVotes } from '../lib/reset-votes';
import { ResolveStoryRequest, ResolvedStory } from 'shared-contracts';

export async function handleResolveStory(
  apiEndpoint: string,
  connectionId: string,
  request: ResolveStoryRequest
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
      message: 'Only the moderator can resolve the story',
    });
    return;
  }

  const resolvedStory: ResolvedStory = {
    title: meta.currentStoryTitle ?? 'Historia sin título',
    finalScore: request.finalScore,
  };

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: roomKey(request.roomId),
      UpdateExpression:
        'SET resolvedStories = list_append(resolvedStories, :story), roundPhase = :idle, revealResult = :null, currentStoryTitle = :null',
      ExpressionAttributeValues: {
        ':story': [resolvedStory],
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
