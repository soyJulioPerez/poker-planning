import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, connectionKey } from '../lib/dynamo-client';
import { getRoomMeta } from '../lib/room-repository';
import { broadcastToRoom, sendToConnection } from '../lib/broadcast';
import { CloseRoomRequest, RoomSummary } from 'shared-contracts';

export async function handleCloseRoom(
  apiEndpoint: string,
  connectionId: string,
  request: CloseRoomRequest
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
      message: 'Only the moderator can close the room',
    });
    return;
  }

  const summary: RoomSummary = {
    stories: meta.resolvedStories,
    totalScore: meta.resolvedStories.reduce((sum, story) => sum + (story.finalScore ?? 0), 0),
  };

  await broadcastToRoom(apiEndpoint, request.roomId, { type: 'roomClosed', summary });
}
