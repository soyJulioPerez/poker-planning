import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, roomKey, participantKey, connectionKey, nowPlusTtl } from '../lib/dynamo-client';
import { generateRoomId } from '../lib/room-id';
import { sendToConnection } from '../lib/broadcast';
import { CreateRoomRequest, Room } from 'shared-contracts';

export async function handleCreateRoom(
  apiEndpoint: string,
  connectionId: string,
  request: CreateRoomRequest
): Promise<void> {
  const roomId = generateRoomId();
  const ttl = nowPlusTtl();

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...roomKey(roomId),
        roomId,
        deckId: request.deckId,
        moderatorName: request.moderatorName,
        moderatorIsVoter: request.moderatorIsVoter,
        roundPhase: 'idle',
        currentStoryTitle: null,
        resolvedStories: [],
        revealResult: null,
        ttl,
      },
    })
  );

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...participantKey(roomId, request.moderatorName),
        name: request.moderatorName,
        connectionId,
        isModerator: true,
        isVoter: request.moderatorIsVoter,
        connected: true,
        vote: null,
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
      ExpressionAttributeValues: { ':roomId': roomId, ':name': request.moderatorName },
    })
  );

  const room: Room = {
    roomId,
    deckId: request.deckId,
    moderatorName: request.moderatorName,
    roundPhase: 'idle',
    currentStoryTitle: null,
    participants: [
      {
        name: request.moderatorName,
        isModerator: true,
        isVoter: request.moderatorIsVoter,
        connected: true,
        vote: null,
      },
    ],
    storiesEstimatedCount: 0,
    accumulatedScore: 0,
    revealResult: null,
    lastResolvedStory: null,
  };

  await sendToConnection(apiEndpoint, connectionId, { type: 'roomState', room });
}
