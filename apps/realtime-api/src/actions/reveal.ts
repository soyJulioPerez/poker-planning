import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, connectionKey } from '../lib/dynamo-client';
import { getRoomMeta, buildRoomState, maskRoomForViewer } from '../lib/room-repository';
import { broadcastRoomState, sendToConnection } from '../lib/broadcast';
import { AVAILABLE_DECKS, RevealRequest, RevealResult, VoteDistributionEntry } from 'shared-contracts';

function toNumeric(value: string, numericValues?: Record<string, number>): number {
  return numericValues?.[value] ?? Number(value);
}

function computeRevealResult(
  votes: Record<string, string>,
  numericValues?: Record<string, number>
): RevealResult {
  const values = Object.values(votes);

  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const distribution: VoteDistributionEntry[] = Array.from(counts.entries()).map(
    ([value, count]) => ({ value, count })
  );

  const parsedValues = values
    .map((value) => toNumeric(value, numericValues))
    .filter((value) => !Number.isNaN(value));

  let average =
    parsedValues.length > 0
      ? Math.round((parsedValues.reduce((sum, v) => sum + v, 0) / parsedValues.length) * 10) / 10
      : null;

  if (average !== null && numericValues) {
    const rawAverage = average;
    const scale = Object.values(numericValues);
    average = scale.reduce((closest, candidate) =>
      Math.abs(candidate - rawAverage) < Math.abs(closest - rawAverage) ? candidate : closest
    );
  }

  let mode: string[] = [];
  if (counts.size > 0) {
    const maxCount = Math.max(...counts.values());
    mode = Array.from(counts.entries())
      .filter(([, count]) => count === maxCount)
      .map(([value]) => value);
  }

  return { votes, distribution, average, mode };
}

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
