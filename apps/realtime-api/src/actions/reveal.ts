import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, connectionKey } from '../lib/dynamo-client';
import { getRoomMeta, buildRoomState, maskRoomForViewer } from '../lib/room-repository';
import { broadcastRoomState, sendToConnection } from '../lib/broadcast';
import { computeRevealResult } from '../lib/reveal-result';
import { AVAILABLE_DECKS, RevealRequest } from 'shared-contracts';

export async function handleReveal(
  apiEndpoint: string,
  connectionId: string,
  request: RevealRequest
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
      message: 'Only the moderator can reveal votes',
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

  const room = await buildRoomState(request.roomId);
  if (!room) return;

  const votes: Record<string, string> = {};
  for (const participant of room.participants) {
    if (participant.vote !== null) {
      votes[participant.name] = participant.vote;
    }
  }

  const deck = AVAILABLE_DECKS.find((d) => d.id === meta.deckId);
  const revealResult = computeRevealResult(votes, deck?.numericValues);

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ROOM#${request.roomId}`, SK: 'META' },
      UpdateExpression: 'SET roundPhase = :revealed, revealResult = :revealResult',
      ExpressionAttributeValues: {
        ':revealed': 'revealed',
        ':revealResult': revealResult,
      },
    })
  );

  const updatedRoom = await buildRoomState(request.roomId);
  if (updatedRoom) {
    await broadcastRoomState(apiEndpoint, updatedRoom, maskRoomForViewer);
  }
}
