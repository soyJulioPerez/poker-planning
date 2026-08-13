import { GetCommand, QueryCommand, UpdateCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { TABLE_NAME } from '../lib/dynamo-client';
import {
  LOCAL_ENDPOINT,
  MensajeEnviado,
  ROOM_ID,
  capturarMensajes,
  claveDe,
  erroresDe,
  participanteFixture,
  salaFixture,
} from './action.fixtures';
import { handleNewRound } from './new-round';

const ddbMock = mockClient(DynamoDBDocumentClient);
const CONNECTION_ID = 'conn-ana';

let enviados: MensajeEnviado[] = [];

function escenarioBase(metaOverrides: Record<string, unknown> = {}, quienPide = 'ana') {
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `CONN#${CONNECTION_ID}`, SK: 'META' } })
    .resolves({ Item: { name: quienPide } });
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
    .resolves({ Item: salaFixture(metaOverrides) });
  ddbMock.on(QueryCommand).resolves({
    Items: [
      participanteFixture('ana', { vote: '5' }),
      participanteFixture('beto', { vote: '8' }),
    ],
  });
  ddbMock.on(UpdateCommand).resolves({});
}

const escrituras = () => ddbMock.commandCalls(UpdateCommand);

beforeEach(() => {
  ddbMock.reset();
  enviados = capturarMensajes();
});

describe('handleNewRound', () => {
  it('vuelve la sala a idle y descarta el resultado del revelado', async () => {
    escenarioBase({ roundPhase: 'revealed' });

    await handleNewRound(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'newRound', roomId: ROOM_ID });

    const sala = escrituras().find((call) => claveDe(call) === 'META');
    expect(sala?.args[0].input.ExpressionAttributeValues).toMatchObject({
      ':idle': 'idle',
      ':null': null,
    });
  });

  // El punto de una nueva ronda es volver a votar sin arrastrar lo anterior: si algún
  // voto sobrevive, el revelado siguiente sale contaminado.
  it('borra el voto de todos los participantes', async () => {
    escenarioBase({ roundPhase: 'revealed' });

    await handleNewRound(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'newRound', roomId: ROOM_ID });

    const votos = escrituras().filter((call) => claveDe(call).startsWith('PARTICIPANT#'));
    expect(votos.map(claveDe).sort()).toEqual(['PARTICIPANT#ana', 'PARTICIPANT#beto']);
    for (const call of votos) {
      expect(call.args[0].input.ExpressionAttributeValues?.[':null']).toBeNull();
    }
  });

  it('rechaza si quien pide no es el moderador', async () => {
    escenarioBase({}, 'beto');

    await handleNewRound(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'newRound', roomId: ROOM_ID });

    expect(erroresDe(enviados)).toEqual([
      { type: 'error', message: 'Only the moderator can start a new round' },
    ]);
    expect(escrituras()).toHaveLength(0);
  });

  it('rechaza si la sala no existe', async () => {
    escenarioBase();
    ddbMock
      .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
      .resolves({});

    await handleNewRound(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'newRound', roomId: ROOM_ID });

    expect(erroresDe(enviados)).toEqual([{ type: 'error', message: 'Room not found' }]);
    expect(escrituras()).toHaveLength(0);
  });
});
