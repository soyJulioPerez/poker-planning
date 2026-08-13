import { GetCommand, QueryCommand, UpdateCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { ServerMessage } from 'shared-contracts';
import { registerLocalTransport } from '../lib/broadcast';
import { TABLE_NAME } from '../lib/dynamo-client';
import { handleVote } from './vote';

const ddbMock = mockClient(DynamoDBDocumentClient);

const LOCAL_ENDPOINT = 'local://test';
const CONNECTION_ID = 'conn-beto';
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

function escenarioBase(metaOverrides: Record<string, unknown> = {}) {
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `CONN#${CONNECTION_ID}`, SK: 'META' } })
    .resolves({ Item: { name: 'beto' } });
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
    .resolves({ Item: meta(metaOverrides) });
  ddbMock.on(QueryCommand).resolves({ Items: [] });
  ddbMock.on(UpdateCommand).resolves({});
}

function mensajesDeError() {
  return enviados.filter((e) => e.message.type === 'error').map((e) => e.message);
}

/** La clave de ordenamiento sobre la que escribió un `UpdateCommand`. */
function claveDe(call: { args: { input: { Key?: Record<string, unknown> } }[] }): string {
  return String(call.args[0].input.Key?.['SK'] ?? '');
}

/** Los `UpdateCommand` que escriben el voto de un participante. */
function escriturasDeVoto() {
  return ddbMock.commandCalls(UpdateCommand).filter((call) => claveDe(call).startsWith('PARTICIPANT#'));
}

beforeEach(() => {
  ddbMock.reset();
  enviados = [];
  registerLocalTransport((connectionId, message) => enviados.push({ connectionId, message }));
});

describe('handleVote', () => {
  describe('camino feliz', () => {
    it('registra el voto del participante', async () => {
      escenarioBase();

      await handleVote(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'vote',
        roomId: ROOM_ID,
        value: '5',
      });

      const escrituras = escriturasDeVoto();
      expect(escrituras).toHaveLength(1);

      expect(claveDe(escrituras[0])).toBe('PARTICIPANT#beto');
      expect(escrituras[0].args[0].input.ExpressionAttributeValues?.[':vote']).toBe('5');
    });

    // El primer voto de una historia es lo que arranca la ronda: hasta entonces la sala
    // está en `idle` y la interfaz muestra "esperando al moderador".
    it('pasa la ronda de idle a voting con el primer voto', async () => {
      escenarioBase({ roundPhase: 'idle' });

      await handleVote(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'vote',
        roomId: ROOM_ID,
        value: '5',
      });

      const transicion = ddbMock.commandCalls(UpdateCommand).find((call) => claveDe(call) === 'META');
      expect(transicion).toBeDefined();
    });

    it('no vuelve a tocar la fase si la ronda ya estaba en voting', async () => {
      escenarioBase({ roundPhase: 'voting' });

      await handleVote(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'vote',
        roomId: ROOM_ID,
        value: '5',
      });

      const transicion = ddbMock.commandCalls(UpdateCommand).find((call) => claveDe(call) === 'META');
      expect(transicion).toBeUndefined();
    });

    // Comportamiento real verificado: el voto se sobrescribe, no se rechaza. El spec no
    // dice nada al respecto, y sobrescribir es lo razonable —cambiar de opinión antes del
    // revelado es parte del juego—, así que se deja especificado acá.
    it('votar de nuevo pisa el voto anterior en vez de rechazarlo', async () => {
      escenarioBase();

      await handleVote(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'vote',
        roomId: ROOM_ID,
        value: '5',
      });
      await handleVote(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'vote',
        roomId: ROOM_ID,
        value: '8',
      });

      const escrituras = escriturasDeVoto();
      expect(escrituras).toHaveLength(2);
      expect(mensajesDeError()).toEqual([]);

      expect(escrituras[1].args[0].input.ExpressionAttributeValues?.[':vote']).toBe('8');
    });
  });

  describe('caminos de error', () => {
    it('rechaza si la conexión no está asociada a ninguna sala', async () => {
      escenarioBase();
      ddbMock
        .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `CONN#${CONNECTION_ID}`, SK: 'META' } })
        .resolves({});

      await handleVote(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'vote',
        roomId: ROOM_ID,
        value: '5',
      });

      expect(mensajesDeError()).toEqual([{ type: 'error', message: 'Not joined to a room' }]);
      expect(escriturasDeVoto()).toHaveLength(0);
    });

    it('rechaza si la sala no existe', async () => {
      escenarioBase();
      ddbMock
        .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
        .resolves({});

      await handleVote(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'vote',
        roomId: ROOM_ID,
        value: '5',
      });

      expect(mensajesDeError()).toEqual([{ type: 'error', message: 'Room not found' }]);
      expect(escriturasDeVoto()).toHaveLength(0);
    });

    it('rechaza si todavía no hay una historia asignada', async () => {
      escenarioBase({ currentStoryTitle: null });

      await handleVote(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'vote',
        roomId: ROOM_ID,
        value: '5',
      });

      expect(mensajesDeError()).toEqual([{ type: 'error', message: 'No story assigned yet' }]);
      expect(escriturasDeVoto()).toHaveLength(0);
    });
  });

  // Huecos de validación encontrados al escribir estos tests. Se dejan como `todo` y NO
  // como aserciones del comportamiento actual: escribir `expect(...).toHaveLength(1)` acá
  // fijaría el hueco como si fuera la regla, y el día que se cierre parecería una
  // regresión. Ver docs/known-issues.md.
  describe('validaciones que el servidor no hace', () => {
    it.todo(
      'debería rechazar el voto de quien no está habilitado como votante (spec: "participante habilitado para votar")'
    );
    it.todo('debería definirse si se puede votar después del revelado — hoy se acepta');
  });
});
