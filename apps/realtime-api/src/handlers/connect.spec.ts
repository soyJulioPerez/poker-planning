import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { logger } from '../lib/logger';
import { handler } from './connect';

const ddbMock = mockClient(DynamoDBDocumentClient);
const CONNECTION_ID = 'conn-beto';

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
});

describe('handler (connect)', () => {
  it('registra la conexion nueva y la guarda en DynamoDB', async () => {
    ddbMock.on(PutCommand).resolves({});
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const result = await handler(evento(), {} as never, () => undefined);

    expect(infoSpy).toHaveBeenCalledWith('connection.open', { connectionId: CONNECTION_ID });
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
    expect(result).toEqual({ statusCode: 200, body: 'Connected' });

    infoSpy.mockRestore();
  });

  // A diferencia de default.ts, aca no hay ningun cliente esperando una respuesta de la
  // app todavia — si el registro de la conexion falla de verdad, lo correcto es relanzar
  // para que la conexion se rechace, no quedar "conectada" sin que el backend la registro.
  it('loguea el error y relanza si falla el registro de la conexion', async () => {
    ddbMock.on(PutCommand).rejects(new Error('ProvisionedThroughputExceededException'));
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);

    let thrown: unknown;
    try {
      await handler(evento(), {} as never, () => undefined);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('ProvisionedThroughputExceededException');
    expect(errorSpy).toHaveBeenCalledWith(
      'connection.open_failed',
      expect.objectContaining({ connectionId: CONNECTION_ID })
    );

    errorSpy.mockRestore();
  });
});
