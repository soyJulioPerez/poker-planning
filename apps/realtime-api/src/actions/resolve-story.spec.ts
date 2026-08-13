import { GetCommand, QueryCommand, UpdateCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { ServerMessage } from 'shared-contracts';
import { registerLocalTransport } from '../lib/broadcast';
import { TABLE_NAME } from '../lib/dynamo-client';
import { handleResolveStory } from './resolve-story';

const ddbMock = mockClient(DynamoDBDocumentClient);

const LOCAL_ENDPOINT = 'local://test';
const CONNECTION_ID = 'conn-ana';
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
    roundPhase: 'revealed',
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
    .resolves({ Item: { name: 'ana' } });
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
    .resolves({ Item: meta(metaOverrides) });
  ddbMock.on(QueryCommand).resolves({ Items: [] });
  ddbMock.on(UpdateCommand).resolves({});
}

function mensajesDeError() {
  return enviados.filter((e) => e.message.type === 'error').map((e) => e.message);
}

function claveDe(call: { args: { input: { Key?: Record<string, unknown> } }[] }): string {
  return String(call.args[0].input.Key?.['SK'] ?? '');
}

/** El `UpdateCommand` que agrega la historia resuelta a la sala. */
function escrituraDeResolucion() {
  return ddbMock.commandCalls(UpdateCommand).find((call) => claveDe(call) === 'META');
}

beforeEach(() => {
  ddbMock.reset();
  enviados = [];
  registerLocalTransport((connectionId, message) => enviados.push({ connectionId, message }));
});

describe('handleResolveStory', () => {
  it('registra la historia resuelta con su puntaje final', async () => {
    escenarioBase();

    await handleResolveStory(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'resolveStory',
      roomId: ROOM_ID,
      finalScore: 8,
    });

    const escritura = escrituraDeResolucion();
    expect(escritura).toBeDefined();
    expect(escritura?.args[0].input.ExpressionAttributeValues?.[':story']).toEqual([
      { title: 'Login con Google', finalScore: 8 },
    ]);
  });

  it('rechaza si quien pide no es el moderador', async () => {
    escenarioBase();
    ddbMock
      .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `CONN#${CONNECTION_ID}`, SK: 'META' } })
      .resolves({ Item: { name: 'beto' } });

    await handleResolveStory(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'resolveStory',
      roomId: ROOM_ID,
      finalScore: 8,
    });

    expect(mensajesDeError()).toEqual([
      { type: 'error', message: 'Only the moderator can resolve the story' },
    ]);
    expect(escrituraDeResolucion()).toBeUndefined();
  });

  // Esta es la defensa que agregó el change `2026-07-11-fix-mode-numeric-only`.
  //
  // El bug original: el botón "Aceptar moda" se mostraba aunque la moda fuera "☕" o "?",
  // y al aceptarla se enviaba un `finalScore` no numérico. La interfaz se corrigió, pero
  // ese change agregó además esta validación en el servidor **como defensa independiente
  // de la interfaz** — que es lo que la vuelve interesante de testear: protege de un
  // cliente viejo, de otro cliente, o de una regresión en la web.
  describe('defensa contra un puntaje no numérico', () => {
    it.each([
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['-Infinity', Number.NEGATIVE_INFINITY],
    ])('rechaza un finalScore de %s y no escribe nada', async (_nombre, valor) => {
      escenarioBase();

      await handleResolveStory(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'resolveStory',
        roomId: ROOM_ID,
        finalScore: valor,
      });

      expect(mensajesDeError()).toEqual([
        { type: 'error', message: 'finalScore must be a finite number' },
      ]);
      expect(escrituraDeResolucion()).toBeUndefined();
    });

    it('acepta un puntaje numérico válido', async () => {
      escenarioBase();

      await handleResolveStory(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'resolveStory',
        roomId: ROOM_ID,
        finalScore: 0,
      });

      expect(mensajesDeError()).toEqual([]);
      expect(escrituraDeResolucion()).toBeDefined();
    });
  });
});
