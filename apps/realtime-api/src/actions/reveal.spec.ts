import { GetCommand, QueryCommand, UpdateCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { ServerMessage } from 'shared-contracts';
import { registerLocalTransport } from '../lib/broadcast';
import { TABLE_NAME } from '../lib/dynamo-client';
import { handleReveal } from './reveal';

const ddbMock = mockClient(DynamoDBDocumentClient);

// `broadcast.ts` ya trae una salida para no hablar con API Gateway: cuando el endpoint
// empieza con `local://` usa el transporte que se registre acá. Es el mismo mecanismo que
// usa el emulador local, así que los tests no necesitan mockear el segundo cliente de AWS.
const LOCAL_ENDPOINT = 'local://test';
const CONNECTION_ID = 'conn-moderador';
const ROOM_ID = 'ABC123';

let enviados: { connectionId: string; message: ServerMessage }[] = [];

function meta(overrides: Record<string, unknown> = {}) {
  return {
    PK: `ROOM#${ROOM_ID}`,
    SK: 'META',
    roomId: ROOM_ID,
    deckId: 'fibonacci',
    iconGroupId: null,
    moderatorName: 'ana',
    moderatorIsVoter: true,
    roundPhase: 'voting',
    currentStoryTitle: 'Login con Google',
    resolvedStories: [],
    revealResult: null,
    ttl: 0,
    ...overrides,
  };
}

function participante(name: string, vote: string | null) {
  return {
    PK: `ROOM#${ROOM_ID}`,
    SK: `PARTICIPANT#${name}`,
    name,
    connectionId: `conn-${name}`,
    isModerator: name === 'ana',
    isVoter: true,
    connected: true,
    vote,
    icon: null,
  };
}

/** Deja el mock respondiendo el camino feliz; cada test ajusta lo que necesita. */
function escenarioBase(metaOverrides: Record<string, unknown> = {}) {
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `CONN#${CONNECTION_ID}`, SK: 'META' } })
    .resolves({ Item: { name: 'ana' } });
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
    .resolves({ Item: meta(metaOverrides) });
  ddbMock.on(QueryCommand).resolves({
    Items: [participante('ana', '5'), participante('beto', '5'), participante('caro', '8')],
  });
  ddbMock.on(UpdateCommand).resolves({});
}

function mensajesDeError() {
  return enviados.filter((e) => e.message.type === 'error').map((e) => e.message);
}

beforeEach(() => {
  ddbMock.reset();
  enviados = [];
  registerLocalTransport((connectionId, message) => enviados.push({ connectionId, message }));
});

describe('handleReveal', () => {
  describe('camino feliz', () => {
    it('marca la ronda como revelada y guarda el resultado calculado', async () => {
      escenarioBase();

      await handleReveal(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'reveal', roomId: ROOM_ID });

      const updates = ddbMock.commandCalls(UpdateCommand);
      expect(updates).toHaveLength(1);

      const input = updates[0].args[0].input as {
        ExpressionAttributeValues: Record<string, unknown>;
      };
      expect(input.ExpressionAttributeValues[':revealed']).toBe('revealed');
      expect(input.ExpressionAttributeValues[':revealResult']).toMatchObject({
        average: 6, // (5 + 5 + 8) / 3 = 6
        mode: ['5'],
      });
    });

    it('difunde el estado de la sala a los participantes', async () => {
      escenarioBase();

      await handleReveal(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'reveal', roomId: ROOM_ID });

      expect(enviados.length).toBeGreaterThan(0);
      expect(enviados.every((e) => e.message.type === 'roomState')).toBe(true);
    });
  });

  // En los tres casos de error interesa lo mismo: que responda con el motivo y que
  // **no escriba nada**. Que no escriba es tan parte de la regla como el mensaje.
  describe('caminos de error', () => {
    it('rechaza si la sala no existe', async () => {
      escenarioBase();
      ddbMock
        .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
        .resolves({});

      await handleReveal(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'reveal', roomId: ROOM_ID });

      expect(mensajesDeError()).toEqual([{ type: 'error', message: 'Room not found' }]);
      expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
    });

    it('rechaza si quien pide no es el moderador', async () => {
      escenarioBase();
      ddbMock
        .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `CONN#${CONNECTION_ID}`, SK: 'META' } })
        .resolves({ Item: { name: 'beto' } });

      await handleReveal(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'reveal', roomId: ROOM_ID });

      expect(mensajesDeError()).toEqual([
        { type: 'error', message: 'Only the moderator can reveal votes' },
      ]);
      expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
    });

    it('rechaza si todavía no hay una historia asignada', async () => {
      escenarioBase({ currentStoryTitle: null });

      await handleReveal(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'reveal', roomId: ROOM_ID });

      expect(mensajesDeError()).toEqual([{ type: 'error', message: 'No story assigned yet' }]);
      expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
    });
  });
});
