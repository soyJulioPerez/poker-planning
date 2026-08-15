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
import { logger } from '../lib/logger';

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  // Hoisteado fuera del try: si algo revienta despues de conocerlo, el catch exterior
  // todavia puede loguear con que roomId estaba trabajando.
  let roomId: string | undefined;

  try {
    const connectionId = event.requestContext.connectionId;

    const connection = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: connectionKey(connectionId) })
    );

    roomId = connection.Item?.['roomId'] as string | undefined;
    const name = connection.Item?.['name'] as string | undefined;

    // `connect` ya loguea cada conexión nueva; sin la contraparte acá no se puede
    // reconstruir la sesión de una sala a partir de los logs. Incluye roomId para
    // poder filtrar por sala, que es lo que pide la Fase 4.1 del roadmap.
    logger.info('connection.close', { connectionId, roomId, name });

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
      } catch (error) {
        // El broadcast es best-effort: un fallo aqui no debe impedir limpiar la conexion,
        // por eso no se relanza. Pero un fallo mudo tampoco sirve — se registra para poder
        // notar si empieza a pasar seguido.
        logger.warn('connection.broadcast_failed', { connectionId, roomId, error });
      }
    }

    await ddb.send(
      new DeleteCommand({ TableName: TABLE_NAME, Key: connectionKey(connectionId) })
    );

    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    // A diferencia del broadcast de arriba, esto no es best-effort: si la limpieza en si
    // falla (el lookup, marcar al participante, o el borrado final), relanzar mantiene la
    // alarma de Errors de Lambda honesta sobre un fallo real de limpieza.
    logger.error('connection.close_failed', {
      connectionId: event.requestContext?.connectionId,
      roomId,
      error,
    });
    throw error;
  }
};
