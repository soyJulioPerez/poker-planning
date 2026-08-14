import { GetCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { TABLE_NAME } from '../lib/dynamo-client';
import { LOCAL_ENDPOINT, MensajeEnviado, ROOM_ID, capturarMensajes, salaFixture } from './action.fixtures';
import { handleGetRoomInfo } from './get-room-info';

const ddbMock = mockClient(DynamoDBDocumentClient);
const CONNECTION_ID = 'conn-anonima';

let enviados: MensajeEnviado[] = [];

beforeEach(() => {
  ddbMock.reset();
  enviados = capturarMensajes();
});

// Esta acción casi no tiene reglas de negocio: lee la sala y responde tres campos. Lo que
// la hace interesante de testear es *quién* puede llamarla — es el único endpoint que se
// usa **sin estar en la sala**: la pantalla de ingreso lo consulta para saber qué mazo y
// qué grupo de íconos dibujar antes de que nadie se una.
describe('handleGetRoomInfo', () => {
  it('devuelve el mazo y el grupo de íconos de la sala', async () => {
    ddbMock
      .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
      .resolves({ Item: salaFixture({ deckId: 'tshirt', iconGroupId: 'animals' }) });

    await handleGetRoomInfo(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'getRoomInfo',
      roomId: ROOM_ID,
    });

    expect(enviados[0].message).toEqual({
      type: 'roomInfo',
      roomId: ROOM_ID,
      deckId: 'tshirt',
      iconGroupId: 'animals',
    });
  });

  // El `toEqual` de arriba ya lo garantiza, pero se deja explícito por lo que protege:
  // quien conoce el código de una sala no debería poder averiguar quién está adentro, qué
  // votaron, ni quién la modera, sin unirse. Si alguien agrega un campo a la respuesta,
  // este test se rompe y obliga a pensarlo.
  it('no filtra participantes, votos ni el nombre del moderador', async () => {
    ddbMock
      .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
      .resolves({ Item: salaFixture() });

    await handleGetRoomInfo(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'getRoomInfo',
      roomId: ROOM_ID,
    });

    expect(Object.keys(enviados[0].message).sort()).toEqual([
      'deckId',
      'iconGroupId',
      'roomId',
      'type',
    ]);
  });

  it('devuelve null como grupo de íconos si la sala no usa ninguno', async () => {
    ddbMock
      .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
      .resolves({ Item: salaFixture({ iconGroupId: null }) });

    await handleGetRoomInfo(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'getRoomInfo',
      roomId: ROOM_ID,
    });

    expect(enviados[0].message).toMatchObject({ iconGroupId: null });
  });

  it('rechaza si la sala no existe', async () => {
    ddbMock.on(GetCommand).resolves({});

    await handleGetRoomInfo(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'getRoomInfo',
      roomId: ROOM_ID,
    });

    expect(enviados[0].message).toEqual({ type: 'joinRejected', reason: 'room-not-found' });
  });
});
