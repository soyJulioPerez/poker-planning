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
  salaFixture,
} from './action.fixtures';
import { handleSetModeratorIsVoter } from './set-moderator-is-voter';

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
  ddbMock.on(QueryCommand).resolves({ Items: [] });
  ddbMock.on(UpdateCommand).resolves({});
}

function escrituras() {
  return ddbMock.commandCalls(UpdateCommand);
}

beforeEach(() => {
  ddbMock.reset();
  enviados = capturarMensajes();
});

describe('handleSetModeratorIsVoter', () => {
  // El estado vive duplicado: `moderatorIsVoter` en la sala y `isVoter` en la fila del
  // participante. Las dos escrituras tienen que ir juntas o la guarda de `handleVote`
  // —que lee la del participante— leería un valor viejo.
  it('escribe el estado en la sala y en la fila del moderador', async () => {
    escenarioBase({ roundPhase: 'idle' });

    await handleSetModeratorIsVoter(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'setModeratorIsVoter',
      roomId: ROOM_ID,
      isVoter: false,
    });

    const claves = escrituras().map(claveDe);
    expect(claves).toContain('META');
    expect(claves).toContain('PARTICIPANT#ana');

    for (const call of escrituras()) {
      expect(call.args[0].input.ExpressionAttributeValues?.[':isVoter']).toBe(false);
    }
  });

  it('rechaza si quien pide no es el moderador', async () => {
    escenarioBase({ roundPhase: 'idle' }, 'beto');

    await handleSetModeratorIsVoter(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'setModeratorIsVoter',
      roomId: ROOM_ID,
      isVoter: false,
    });

    expect(erroresDe(enviados)).toEqual([
      { type: 'error', message: 'Only the moderator can change this setting' },
    ]);
    expect(escrituras()).toHaveLength(0);
  });

  // Esta guarda y la de `handleVote` protegen el mismo estado desde lados opuestos: acá se
  // impide cambiar `isVoter` con una ronda en curso, y allá se impide votar a quien no lo
  // tiene. Juntas evitan que alguien vote y después se declare no-votante, o al revés.
  it.each([['voting'], ['revealed']])(
    'rechaza el cambio con la ronda en %s',
    async (fase) => {
      escenarioBase({ roundPhase: fase });

      await handleSetModeratorIsVoter(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'setModeratorIsVoter',
        roomId: ROOM_ID,
        isVoter: false,
      });

      expect(erroresDe(enviados)).toEqual([
        { type: 'error', message: 'Cannot change voter status while a round is active' },
      ]);
      expect(escrituras()).toHaveLength(0);
    }
  );

  it('rechaza si la sala no existe', async () => {
    escenarioBase();
    ddbMock
      .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
      .resolves({});

    await handleSetModeratorIsVoter(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'setModeratorIsVoter',
      roomId: ROOM_ID,
      isVoter: false,
    });

    expect(erroresDe(enviados)).toEqual([{ type: 'error', message: 'Room not found' }]);
    expect(escrituras()).toHaveLength(0);
  });
});
