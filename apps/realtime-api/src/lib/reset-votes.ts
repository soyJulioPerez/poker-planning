import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, participantKey } from './dynamo-client';
import { getRoomParticipants } from './room-repository';

export async function resetVotes(roomId: string): Promise<void> {
  const participants = await getRoomParticipants(roomId);
  await Promise.all(
    participants.map((participant) =>
      ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: participantKey(roomId, participant.name),
          UpdateExpression: 'SET vote = :null',
          ExpressionAttributeValues: { ':null': null },
        })
      )
    )
  );
}
