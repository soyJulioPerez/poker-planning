import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
});

export const ddb = DynamoDBDocumentClient.from(client);

export const TABLE_NAME = process.env.TABLE_NAME ?? 'poker-planning-table';

export const ROOM_TTL_SECONDS = 4 * 60 * 60;

export function roomKey(roomId: string) {
  return { PK: `ROOM#${roomId}`, SK: 'META' };
}

export function participantKey(roomId: string, name: string) {
  return { PK: `ROOM#${roomId}`, SK: `PARTICIPANT#${name}` };
}

export function connectionKey(connectionId: string) {
  return { PK: `CONN#${connectionId}`, SK: 'META' };
}

export function nowPlusTtl(seconds: number = ROOM_TTL_SECONDS): number {
  return Math.floor(Date.now() / 1000) + seconds;
}
