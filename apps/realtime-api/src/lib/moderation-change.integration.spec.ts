import { randomUUID } from 'node:crypto';
import { PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, roomKey, participantKey, nowPlusTtl } from './dynamo-client';
import { getRoomMeta, getRoomParticipants } from './room-repository';
import { commitModerationChange } from './moderation-change';

// Corre contra DynamoDB Local real (npm run dev:db:up + dev:db:create-table): las
// condiciones de la transacción son lo que decide quién gana una carrera, y
// aws-sdk-client-mock nunca las evalúa. Mismo esquema de limpieza que
// room-repository.integration.spec.ts.

const AHORA = Date.now();
const PLAZO = AHORA - 60_000;

let itemsCreados: { PK: string; SK: string }[] = [];

async function poner(Key: { PK: string; SK: string }, item: Record<string, unknown>) {
  itemsCreados.push(Key);
  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: { ...Key, ...item } }));
}

/** Sala moderada por Ana, con Beto y Carla conectados. */
async function crearSala(anaOverrides: Record<string, unknown> = {}): Promise<string> {
  const roomId = `test-${randomUUID()}`;
  await poner(roomKey(roomId), {
    roomId,
    deckId: 'fibonacci',
    iconGroupId: null,
    moderatorName: 'ana',
    moderatorIsVoter: false,
    roundPhase: 'voting',
    currentStoryTitle: 'Historia de prueba',
    resolvedStories: [],
    revealResult: null,
    ttl: nowPlusTtl(),
  });
  for (const name of ['ana', 'beto', 'carla']) {
    await poner(participantKey(roomId, name), {
      name,
      connectionId: `conn-${name}`,
      isModerator: name === 'ana',
      isVoter: name !== 'ana',
      connected: true,
      vote: name === 'beto' ? '5' : null,
      icon: null,
      ...(name === 'ana' ? anaOverrides : {}),
    });
  }
  return roomId;
}

async function moderadores(roomId: string) {
  const participantes = await getRoomParticipants(roomId);
  return participantes.filter((p) => p.isModerator).map((p) => p.name);
}

afterEach(async () => {
  await Promise.all(itemsCreados.map((Key) => ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key }))));
  itemsCreados = [];
});

describe('commitModerationChange (integración contra DynamoDB Local)', () => {
  it('cede el rol: sala y participantes quedan consistentes y la ronda intacta', async () => {
    const roomId = await crearSala();

    const ok = await commitModerationChange({ roomId, previousModerator: 'ana', nextModerator: 'beto' });

    expect(ok).toBe(true);
    const meta = await getRoomMeta(roomId);
    expect(meta?.moderatorName).toBe('beto');
    expect(meta?.moderatorIsVoter).toBe(true);
    expect(meta?.roundPhase).toBe('voting');
    expect(await moderadores(roomId)).toEqual(['beto']);
    const participantes = await getRoomParticipants(roomId);
    expect(participantes.find((p) => p.name === 'ana')?.isVoter).toBe(true);
    expect(participantes.find((p) => p.name === 'beto')?.vote).toBe('5');
  });

  it('dos tomas simultáneas: exactamente una gana', async () => {
    const roomId = await crearSala({ connected: false, disconnectedAt: AHORA - 120_000 });

    const resultados = await Promise.all([
      commitModerationChange({
        roomId,
        previousModerator: 'ana',
        nextModerator: 'beto',
        previousDisconnectedBefore: PLAZO,
      }),
      commitModerationChange({
        roomId,
        previousModerator: 'ana',
        nextModerator: 'carla',
        previousDisconnectedBefore: PLAZO,
      }),
    ]);

    expect(resultados.filter(Boolean)).toHaveLength(1);
    const ganador = resultados[0] ? 'beto' : 'carla';
    expect((await getRoomMeta(roomId))?.moderatorName).toBe(ganador);
    expect(await moderadores(roomId)).toEqual([ganador]);
  });

  it('no toma el rol si la moderadora volvió a conectarse', async () => {
    const roomId = await crearSala({ connected: true });

    const ok = await commitModerationChange({
      roomId,
      previousModerator: 'ana',
      nextModerator: 'beto',
      previousDisconnectedBefore: PLAZO,
    });

    expect(ok).toBe(false);
    expect((await getRoomMeta(roomId))?.moderatorName).toBe('ana');
    expect(await moderadores(roomId)).toEqual(['ana']);
  });

  it('no toma el rol si la moderadora se cayó hace menos del plazo', async () => {
    const roomId = await crearSala({ connected: false, disconnectedAt: AHORA - 10_000 });

    const ok = await commitModerationChange({
      roomId,
      previousModerator: 'ana',
      nextModerator: 'beto',
      previousDisconnectedBefore: PLAZO,
    });

    expect(ok).toBe(false);
    expect((await getRoomMeta(roomId))?.moderatorName).toBe('ana');
  });

  it('toma el rol si la moderadora está caída sin marca de tiempo (registro previo)', async () => {
    const roomId = await crearSala({ connected: false });

    const ok = await commitModerationChange({
      roomId,
      previousModerator: 'ana',
      nextModerator: 'beto',
      previousDisconnectedBefore: PLAZO,
    });

    expect(ok).toBe(true);
    expect(await moderadores(roomId)).toEqual(['beto']);
  });

  it('no cede a alguien que no existe, y no lo crea', async () => {
    const roomId = await crearSala();

    const ok = await commitModerationChange({ roomId, previousModerator: 'ana', nextModerator: 'zoe' });

    expect(ok).toBe(false);
    const participantes = await getRoomParticipants(roomId);
    expect(participantes.map((p) => p.name)).not.toContain('zoe');
  });
});
