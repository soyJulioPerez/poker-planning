import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, connectionKey, nowPlusTtl } from '../lib/dynamo-client';
import { logger } from '../lib/logger';

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    logger.info('connection.open', { connectionId });

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...connectionKey(connectionId),
          connectedAt: Date.now(),
          ttl: nowPlusTtl(),
        },
      })
    );

    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    // A diferencia de `default.ts`, aca no hay a quien responderle: si esto falla, la
    // conexion debe rechazarse de verdad (relanzar), no quedar "conectada" del lado del
    // cliente sin que el backend la haya registrado.
    logger.error('connection.open_failed', { connectionId: event.requestContext?.connectionId, error });
    throw error;
  }
};
