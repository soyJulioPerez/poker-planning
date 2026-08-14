import { GetCommand, QueryCommand, UpdateCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { TABLE_NAME } from '../lib/dynamo-client';
import {
  LOCAL_ENDPOINT,
  MensajeEnviado,
  ROOM_ID,
  capturarMensajes,
  erroresDe,
  participanteFixture,
  salaFixture,
} from './action.fixtures';
import { handleCloseRoom } from './close-room';

const ddbMock = mockClient(DynamoDBDocumentClient);
const CONNECTION_ID = 'conn-ana';

let enviados: MensajeEnviado[] = [];

const HISTORIAS = [
  { title: 'Login con Google', finalScore: 5 },
  { title: 'Recuperar contraseña', finalScore: 8 },
];

function escenarioBase(metaOverrides: Record<string, unknown> = {}, quienPide = 'ana') {
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `CONN#${CONNECTION_ID}`, SK: 'META' } })
    .resolves({ Item: { name: quienPide } });
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
    .resolves({ Item: salaFixture(metaOverrides) });
  ddbMock
    .on(QueryCommand)
    .resolves({ Items: [participanteFixture('ana'), participanteFixture('beto')] });
  ddbMock.on(UpdateCommand).resolves({});
}

function resumenes() {
  return enviados.filter((e) => e.message.type === 'roomClosed').map((e) => e.message);
}

beforeEach(() => {
  ddbMock.reset();
  enviados = capturarMensajes();
});

describe('handleCloseRoom', () => {
  it('difunde el resumen con las historias resueltas y su total', async () => {
    escenarioBase({ resolvedStories: HISTORIAS });

    await handleCloseRoom(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'closeRoom', roomId: ROOM_ID });

    expect(resumenes()).toHaveLength(2); // uno por participante conectado
    expect(resumenes()[0]).toMatchObject({
      type: 'roomClosed',
      summary: { stories: HISTORIAS, totalScore: 13 },
    });
  });

  it('cierra con total en cero si no se resolvió ninguna historia', async () => {
    escenarioBase({ resolvedStories: [] });

    await handleCloseRoom(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'closeRoom', roomId: ROOM_ID });

    expect(resumenes()[0]).toMatchObject({ summary: { stories: [], totalScore: 0 } });
  });

  // Cerrar la sala no borra nada: el resumen se arma con lo que ya está en la sala y se
  // difunde. Los datos se van solos por TTL.
  it('no escribe en la base', async () => {
    escenarioBase({ resolvedStories: HISTORIAS });

    await handleCloseRoom(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'closeRoom', roomId: ROOM_ID });

    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('rechaza si quien pide no es el moderador', async () => {
    escenarioBase({}, 'beto');

    await handleCloseRoom(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'closeRoom', roomId: ROOM_ID });

    expect(erroresDe(enviados)).toEqual([
      { type: 'error', message: 'Only the moderator can close the room' },
    ]);
    expect(resumenes()).toEqual([]);
  });

  it('rechaza si la sala no existe', async () => {
    escenarioBase();
    ddbMock
      .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
      .resolves({});

    await handleCloseRoom(LOCAL_ENDPOINT, CONNECTION_ID, { action: 'closeRoom', roomId: ROOM_ID });

    expect(erroresDe(enviados)).toEqual([{ type: 'error', message: 'Room not found' }]);
    expect(resumenes()).toEqual([]);
  });
});
