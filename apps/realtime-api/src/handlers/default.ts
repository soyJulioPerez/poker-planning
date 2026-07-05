import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { apiEndpointFromEvent, sendToConnection } from '../lib/broadcast';
import { handleCreateRoom } from '../actions/create-room';
import { handleJoinRoom } from '../actions/join-room';
import { ClientRequest } from 'shared-contracts';

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const apiEndpoint = apiEndpointFromEvent(event);

  let request: ClientRequest;
  try {
    request = JSON.parse(event.body ?? '{}');
  } catch {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Invalid message payload',
    });
    return { statusCode: 200, body: 'OK' };
  }

  try {
    switch (request.action) {
      case 'createRoom':
        await handleCreateRoom(apiEndpoint, connectionId, request);
        break;
      case 'joinRoom':
        await handleJoinRoom(apiEndpoint, connectionId, request);
        break;
      default:
        await sendToConnection(apiEndpoint, connectionId, {
          type: 'error',
          message: `Unsupported action: ${(request as { action?: string }).action}`,
        });
    }
  } catch (error) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return { statusCode: 200, body: 'OK' };
};
