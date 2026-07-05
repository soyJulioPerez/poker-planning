import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { GetCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb,
  TABLE_NAME,
  connectionKey,
  participantKey,
} from '../lib/dynamo-client';
import { apiEndpointFromEvent, broadcastToRoom } from '../lib/broadcast';
import { buildRoomState } from '../lib/room-repository';

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;

  const connection = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: connectionKey(connectionId) })
  );

  const roomId = connection.Item?.['roomId'] as string | undefined;
  const name = connection.Item?.['name'] as string | undefined;

  if (roomId && name) {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: participantKey(roomId, name),
        UpdateExpression: 'SET connected = :false',
        ExpressionAttributeValues: { ':false': false },
      })
    );

    try {
      const room = await buildRoomState(roomId);
      if (room) {
        const apiEndpoint = apiEndpointFromEvent(event);
        await broadcastToRoom(apiEndpoint, roomId, { type: 'roomState', room });
      }
    } catch {
      // El broadcast es best-effort: un fallo aqui no debe impedir limpiar la conexion.
    }
  }

  await ddb.send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: connectionKey(connectionId) })
  );

  return { statusCode: 200, body: 'Disconnected' };
};
