import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from './dynamo-client';
import { ServerMessage } from 'shared-contracts';

const LOCAL_ENDPOINT_PREFIX = 'local://';

type LocalTransport = (connectionId: string, message: ServerMessage) => void;

let localTransport: LocalTransport | undefined;

export function registerLocalTransport(transport: LocalTransport): void {
  localTransport = transport;
}

let managementClient: ApiGatewayManagementApiClient | undefined;

function getManagementClient(endpoint: string): ApiGatewayManagementApiClient {
  if (!managementClient) {
    managementClient = new ApiGatewayManagementApiClient({ endpoint });
  }
  return managementClient;
}

export async function getRoomConnectionIds(roomId: string): Promise<string[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `ROOM#${roomId}`,
        ':prefix': 'PARTICIPANT#',
      },
    })
  );

  return (result.Items ?? [])
    .map((item) => item['connectionId'] as string | undefined)
    .filter((id): id is string => Boolean(id));
}

async function postToConnection(
  apiEndpoint: string,
  connectionId: string,
  message: ServerMessage
): Promise<void> {
  if (apiEndpoint.startsWith(LOCAL_ENDPOINT_PREFIX)) {
    if (!localTransport) {
      throw new Error('No local transport registered for local:// endpoint');
    }
    localTransport(connectionId, message);
    return;
  }

  const client = getManagementClient(apiEndpoint);
  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(message)),
      })
    );
  } catch (error) {
    if (error instanceof GoneException) {
      await ddb.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { PK: `CONN#${connectionId}`, SK: 'META' },
        })
      );
      return;
    }
    throw error;
  }
}

export async function broadcastToRoom(
  apiEndpoint: string,
  roomId: string,
  message: ServerMessage
): Promise<void> {
  const connectionIds = await getRoomConnectionIds(roomId);
  await Promise.all(
    connectionIds.map((connectionId) => postToConnection(apiEndpoint, connectionId, message))
  );
}

export async function sendToConnection(
  apiEndpoint: string,
  connectionId: string,
  message: ServerMessage
): Promise<void> {
  await postToConnection(apiEndpoint, connectionId, message);
}

export function apiEndpointFromEvent(event: {
  requestContext: { domainName?: string; stage?: string };
}): string {
  const { domainName, stage } = event.requestContext;
  return `https://${domainName}/${stage}`;
}
