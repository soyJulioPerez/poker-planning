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
import { handleNextStory } from './next-story';

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
  ddbMock
    .on(QueryCommand)
    .resolves({ Items: [participanteFixture('ana', { vote: '5' })] });
  ddbMock.on(UpdateCommand).resolves({});
}

const escrituras = () => ddbMock.commandCalls(UpdateCommand);

beforeEach(() => {
  ddbMock.reset();
  enviados = capturarMensajes();
});

describe('handleNextStory', () => {
  it('asigna el título nuevo y deja la ronda lista para votar', async () => {
    escenarioBase({ roundPhase: 'revealed' });

    await handleNextStory(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'nextStory',
      roomId: ROOM_ID,
      storyTitle: 'Recuperar contraseña',
    });

    const sala = escrituras().find((call) => claveDe(call) === 'META');
    expect(sala?.args[0].input.ExpressionAttributeValues).toMatchObject({
      ':title': 'Recuperar contraseña',
      ':idle': 'idle',
      ':null': null,
    });
  });

  it('borra los votos de la historia anterior', async () => {
    escenarioBase({ roundPhase: 'revealed' });

    await handleNextStory(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'nextStory',
      roomId: ROOM_ID,
      storyTitle: 'Recuperar contraseña',
    });

    const votos = escrituras().filter((call) => claveDe(call).startsWith('PARTICIPANT#'));
    expect(votos).toHaveLength(1);
    expect(votos[0].args[0].input.ExpressionAttributeValues?.[':null']).toBeNull();
  });

  it('rechaza si quien pide no es el moderador', async () => {
    escenarioBase({}, 'beto');

    await handleNextStory(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'nextStory',
      roomId: ROOM_ID,
      storyTitle: 'Recuperar contraseña',
    });

    expect(erroresDe(enviados)).toEqual([
      { type: 'error', message: 'Only the moderator can advance to the next story' },
    ]);
    expect(escrituras()).toHaveLength(0);
  });

  it('rechaza si la sala no existe', async () => {
    escenarioBase();
    ddbMock
      .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
      .resolves({});

    await handleNextStory(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'nextStory',
      roomId: ROOM_ID,
      storyTitle: 'Recuperar contraseña',
    });

    expect(erroresDe(enviados)).toEqual([{ type: 'error', message: 'Room not found' }]);
    expect(escrituras()).toHaveLength(0);
  });
});
