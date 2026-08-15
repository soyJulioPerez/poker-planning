import { GetCommand, QueryCommand, UpdateCommand, DeleteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { TABLE_NAME } from '../lib/dynamo-client';
import { logger } from '../lib/logger';
import { handler } from './disconnect';

const ddbMock = mockClient(DynamoDBDocumentClient);
const CONNECTION_ID = 'conn-beto';
const ROOM_ID = 'ABC123';

function evento(): APIGatewayProxyWebsocketEventV2 {
  return {
    requestContext: {
      connectionId: CONNECTION_ID,
      domainName: 'example.execute-api.us-east-2.amazonaws.com',
      stage: 'dev',
    },
  } as unknown as APIGatewayProxyWebsocketEventV2;
}

beforeEach(() => {
  ddbMock.reset();
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `CONN#${CONNECTION_ID}`, SK: 'META' } })
    .resolves({ Item: { roomId: ROOM_ID, name: 'beto' } });
  ddbMock.on(UpdateCommand).resolves({});
  ddbMock.on(DeleteCommand).resolves({});
});

// Este catch es best-effort a propósito: la limpieza de la conexión no debe depender de
// que el broadcast final funcione. Lo que este test verifica es la otra mitad de esa
// decisión — que un fallo ahí deje rastro en vez de desaparecer en silencio.
describe('handler (disconnect) — el broadcast best-effort', () => {
  it('registra una advertencia si buildRoomState falla, y no interrumpe la limpieza', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    // getRoomMeta (dentro de buildRoomState) hace un GetCommand sobre la sala; se lo hace
    // fallar para simular, por ejemplo, un problema transitorio de DynamoDB.
    ddbMock
      .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
      .rejects(new Error('ProvisionedThroughputExceededException'));

    const result = await handler(evento(), {} as never, () => undefined);

    expect(warnSpy).toHaveBeenCalledWith(
      'connection.broadcast_failed',
      expect.objectContaining({ connectionId: CONNECTION_ID, roomId: ROOM_ID })
    );
    // La limpieza de la conexión sigue corriendo pese al fallo del broadcast.
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(1);
    expect(result).toEqual({ statusCode: 200, body: 'Disconnected' });

    warnSpy.mockRestore();
  });

  it('no advierte nada cuando el broadcast sale bien', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    ddbMock
      .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
      .resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    await handler(evento(), {} as never, () => undefined);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
