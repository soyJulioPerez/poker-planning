import { randomUUID } from 'node:crypto';
import { PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, roomKey, participantKey, nowPlusTtl } from './dynamo-client';
import { getRoomMeta, getRoomParticipants, buildRoomState } from './room-repository';

// Corre contra DynamoDB Local real (npm run dev:db:up + dev:db:create-table), no contra
// un mock: prueba que las expresiones de query (PK/SK, begins_with) esten bien armadas,
// algo que aws-sdk-client-mock no puede detectar porque nunca evalua la expresion real.
// Cada test usa su propio roomId (nuevoRoomId). La limpieza es via afterEach, no al final
// de cada test — asi corre igual si una asercion falla a mitad de camino, sin dejar
// items huerfanos en la base que use `npm run dev:api` a mano.

let itemsCreados: { PK: string; SK: string }[] = [];

function nuevoRoomId(): string {
  return `test-${randomUUID()}`;
}

async function crearSalaMeta(roomId: string, overrides: Record<string, unknown> = {}) {
  const Key = roomKey(roomId);
  itemsCreados.push(Key);
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...Key,
        roomId,
        deckId: 'fibonacci',
        iconGroupId: null,
        moderatorName: 'ana',
        moderatorIsVoter: true,
        roundPhase: 'voting',
        currentStoryTitle: 'Historia de prueba',
        resolvedStories: [],
        revealResult: null,
        ttl: nowPlusTtl(),
        ...overrides,
      },
    })
  );
}

async function agregarParticipante(roomId: string, name: string, overrides: Record<string, unknown> = {}) {
  const Key = participantKey(roomId, name);
  itemsCreados.push(Key);
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...Key,
        name,
        connectionId: `conn-${name}`,
        isModerator: false,
        isVoter: true,
        connected: true,
        vote: null,
        icon: null,
        ...overrides,
      },
    })
  );
}

afterEach(async () => {
  await Promise.all(itemsCreados.map((Key) => ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key }))));
  itemsCreados = [];
});

describe('room-repository (integración contra DynamoDB Local)', () => {
  describe('getRoomMeta', () => {
    it('lee la sala por PK/SK real', async () => {
      const roomId = nuevoRoomId();
      await crearSalaMeta(roomId);

      const meta = await getRoomMeta(roomId);

      expect(meta?.roomId).toBe(roomId);
      expect(meta?.deckId).toBe('fibonacci');
    });

    it('devuelve undefined si la sala no existe', async () => {
      const meta = await getRoomMeta(nuevoRoomId());

      expect(meta).toBeUndefined();
    });

    it('el ttl queda guardado como epoch futuro', async () => {
      const roomId = nuevoRoomId();
      const antesDelTtl = Math.floor(Date.now() / 1000);
      await crearSalaMeta(roomId);

      const meta = await getRoomMeta(roomId);

      expect(meta?.ttl).toBeGreaterThan(antesDelTtl);
    });
  });

  describe('getRoomParticipants', () => {
    it('la query con begins_with trae solo los participantes de esa sala', async () => {
      const roomId = nuevoRoomId();
      const otraRoomId = nuevoRoomId();
      await crearSalaMeta(roomId);
      await crearSalaMeta(otraRoomId);
      await agregarParticipante(roomId, 'ana');
      await agregarParticipante(roomId, 'beto');
      await agregarParticipante(otraRoomId, 'caro');

      const participantes = await getRoomParticipants(roomId);

      expect(participantes.map((p) => p.name).sort()).toEqual(['ana', 'beto']);
    });

    it('devuelve vacío si la sala no tiene participantes', async () => {
      const participantes = await getRoomParticipants(nuevoRoomId());

      expect(participantes).toEqual([]);
    });
  });

  describe('buildRoomState', () => {
    it('arma la sala completa combinando meta y participantes reales', async () => {
      const roomId = nuevoRoomId();
      await crearSalaMeta(roomId, { moderatorName: 'ana' });
      await agregarParticipante(roomId, 'ana', { isModerator: true, vote: '5' });
      await agregarParticipante(roomId, 'beto', { vote: '8' });

      const room = await buildRoomState(roomId);

      expect(room?.roomId).toBe(roomId);
      expect(room?.participants).toHaveLength(2);
      expect(room?.participants.find((p) => p.name === 'ana')?.isModerator).toBe(true);
    });

    it('devuelve undefined si la sala no existe', async () => {
      const room = await buildRoomState(nuevoRoomId());

      expect(room).toBeUndefined();
    });
  });
});
