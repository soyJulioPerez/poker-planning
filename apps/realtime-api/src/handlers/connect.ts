import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, connectionKey, nowPlusTtl } from '../lib/dynamo-client';

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;

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
};
