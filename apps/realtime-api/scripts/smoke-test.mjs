#!/usr/bin/env node
// Smoke test funcional post-deploy (Fase 6.1 del hardening roadmap): conecta por
// WebSocket contra el endpoint recien desplegado y ejercita el flujo real de una
// sala (crear, unir, asignar historia, votar, revelar). Reusa RoomClient de
// room-client-runtime en vez de reimplementar el protocolo — para eso existe ese
// paquete, agnostico de framework (ver openspec/specs/release-versioning no, ver
// openspec/specs/room-client-runtime/spec.md).
//
// Requiere el build de room-client-runtime ya hecho (import por path relativo al
// dist, no por el specifier "room-client-runtime" — ese solo resuelve via
// tsconfig paths dentro del toolchain de Nx/TS, un script Node plano no lo ve).
//
// Uso: node smoke-test.mjs --ws-url=wss://... --table=nombre-tabla

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { firstValueFrom } from 'rxjs';
import { filter, timeout } from 'rxjs/operators';
import { RoomClient } from '../../../dist/packages/room-client-runtime/src/index.js';

const TIMEOUT_MS = 15000;

function parseArgs() {
  const parsed = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

// RoomClient exige un SessionStore por constructor; el smoke test no necesita
// persistir sesion entre corridas, asi que es un no-op.
class NoopSessionStore {
  get() {
    return null;
  }
  save() {
    // no-op: nada en el smoke test depende de persistir la sesión.
  }
  clear() {
    // no-op: nada en el smoke test depende de borrar la sesión.
  }
}

function roomKey(roomId) {
  return { PK: `ROOM#${roomId}`, SK: 'META' };
}

function participantKey(roomId, name) {
  return { PK: `ROOM#${roomId}`, SK: `PARTICIPANT#${name}` };
}

async function waitForRoom(client, predicate, label) {
  try {
    return await firstValueFrom(
      client.room$.pipe(
        filter((room) => room !== null && predicate(room)),
        timeout(TIMEOUT_MS)
      )
    );
  } catch {
    throw new Error(`Timeout esperando: ${label}`);
  }
}

async function cleanup(ddb, table, roomId, names) {
  if (!roomId) return;
  console.log(`→ Limpiando datos de la sala ${roomId}`);
  const deletes = [roomKey(roomId), ...names.map((name) => participantKey(roomId, name))];
  const results = await Promise.allSettled(
    deletes.map((Key) => ddb.send(new DeleteCommand({ TableName: table, Key })))
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.warn(
      `⚠ ${failed.length} de ${deletes.length} borrados fallaron:`,
      failed.map((r) => r.reason?.message ?? r.reason)
    );
  } else {
    console.log('✓ Limpieza completa');
  }
}

async function main() {
  const { 'ws-url': wsUrl, table } = parseArgs();
  if (!wsUrl || !table) {
    console.error('Uso: smoke-test.mjs --ws-url=<wss://...> --table=<nombre-tabla>');
    process.exit(1);
  }

  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const moderatorName = `smoke-mod-${Date.now()}`;
  const participantName = `smoke-part-${Date.now()}`;
  const moderator = new RoomClient({ websocketUrl: wsUrl }, new NoopSessionStore());
  const participant = new RoomClient({ websocketUrl: wsUrl }, new NoopSessionStore());
  let roomId = null;

  try {
    moderator.connect();

    console.log('→ createRoom');
    moderator.send({
      action: 'createRoom',
      moderatorName,
      deckId: 'fibonacci',
      moderatorIsVoter: true,
    });
    const created = await waitForRoom(moderator, () => true, 'createRoom → roomState');
    roomId = created.roomId;
    console.log(`✓ Sala creada: ${roomId}`);

    console.log('→ joinRoom');
    participant.connect();
    participant.send({ action: 'joinRoom', roomId, name: participantName });
    await waitForRoom(
      participant,
      (room) => room.participants.some((p) => p.name === participantName),
      'joinRoom → roomState con el participante'
    );
    console.log('✓ Participante unido');

    // Sin esto, vote/reveal rechazan con "No story assigned yet" — createRoom deja
    // currentStoryTitle en null a proposito (ver apps/realtime-api/src/actions/create-room.ts).
    console.log('→ nextStory');
    moderator.send({ action: 'nextStory', roomId, storyTitle: 'Historia de prueba (smoke test)' });
    await waitForRoom(moderator, (room) => room.currentStoryTitle !== null, 'nextStory → historia asignada');
    console.log('✓ Historia asignada');

    console.log('→ vote (moderador y participante)');
    moderator.send({ action: 'vote', roomId, value: '5' });
    participant.send({ action: 'vote', roomId, value: '8' });
    await waitForRoom(
      moderator,
      (room) => room.participants.every((p) => !p.isVoter || p.vote !== null),
      'ambos votos registrados'
    );
    console.log('✓ Votos registrados');

    console.log('→ reveal');
    moderator.send({ action: 'reveal', roomId });
    await waitForRoom(moderator, (room) => room.revealResult !== null, 'reveal → revealResult');
    console.log('✓ Revelado correctamente');

    console.log('\n✔ Smoke test OK');
  } finally {
    await cleanup(ddb, table, roomId, [moderatorName, participantName]);
  }
}

main().catch((error) => {
  console.error(`\n✘ Smoke test FALLÓ: ${error.message}`);
  process.exit(1);
});
