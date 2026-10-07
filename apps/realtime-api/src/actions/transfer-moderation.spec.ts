import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
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
import { handleTransferModeration } from './transfer-moderation';

const ddbMock = mockClient(DynamoDBDocumentClient);
const CONNECTION_ID = 'conn-ana';

let enviados: MensajeEnviado[] = [];

function escenarioBase(
  participantes = [participanteFixture('ana'), participanteFixture('beto')],
  quienPide = 'ana'
) {
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `CONN#${CONNECTION_ID}`, SK: 'META' } })
    .resolves({ Item: { name: quienPide } });
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
    .resolves({ Item: salaFixture() });
  ddbMock.on(QueryCommand).resolves({ Items: participantes });
  ddbMock.on(TransactWriteCommand).resolves({});
}

function transacciones() {
  return ddbMock.commandCalls(TransactWriteCommand);
}

/** Los `Update` de la transacción, indexados por la clave de ordenamiento que tocan. */
function escriturasDeLaTransaccion() {
  const items = transacciones()[0].args[0].input.TransactItems ?? [];
  return Object.fromEntries(items.map((item) => [String(item.Update?.Key?.['SK']), item.Update]));
}

function ceder(targetName: string) {
  return handleTransferModeration(LOCAL_ENDPOINT, CONNECTION_ID, {
    action: 'transferModeration',
    roomId: ROOM_ID,
    targetName,
  });
}

beforeEach(() => {
  ddbMock.reset();
  enviados = capturarMensajes();
});

describe('handleTransferModeration', () => {
  // El rol vive en tres lugares; si no se escriben juntos, la sala puede quedar con dos
  // íconos de moderador o con un `moderatorName` que nadie en la lista tiene marcado.
  it('pasa el rol en una sola transacción: sala, nuevo moderador y moderador anterior', async () => {
    escenarioBase();

    await ceder('beto');

    expect(transacciones()).toHaveLength(1);
    const escrituras = escriturasDeLaTransaccion();
    expect(escrituras['META']?.ExpressionAttributeValues).toMatchObject({
      ':next': 'beto',
      ':previous': 'ana',
    });
    expect(escrituras['META']?.ConditionExpression).toBe('moderatorName = :previous');
    expect(escrituras['PARTICIPANT#beto']?.UpdateExpression).toBe(
      'SET isModerator = :true, isVoter = :true'
    );
    expect(escrituras['PARTICIPANT#ana']?.UpdateExpression).toBe(
      'SET isModerator = :false, isVoter = :true'
    );
    expect(erroresDe(enviados)).toEqual([]);
  });

  it('no toca la ronda: ni fase, ni historia, ni votos', async () => {
    escenarioBase();

    await ceder('beto');

    const expresiones = Object.values(escriturasDeLaTransaccion()).map((u) => u?.UpdateExpression);
    for (const expresion of expresiones) {
      expect(expresion).not.toMatch(/roundPhase|currentStoryTitle|vote|revealResult/);
    }
  });

  it('avisa a la sala con el nuevo estado', async () => {
    escenarioBase();

    await ceder('beto');

    expect(enviados.some((e) => e.message.type === 'roomState')).toBe(true);
  });

  it('rechaza si quien pide no es el moderador', async () => {
    escenarioBase(undefined, 'beto');

    await ceder('ana');

    expect(erroresDe(enviados)).toEqual([
      { type: 'error', message: 'Only the moderator can transfer moderation' },
    ]);
    expect(transacciones()).toHaveLength(0);
  });

  it('rechaza ceder a un participante desconectado', async () => {
    escenarioBase([participanteFixture('ana'), participanteFixture('beto', { connected: false })]);

    await ceder('beto');

    expect(erroresDe(enviados)).toEqual([
      { type: 'error', message: 'Moderation can only be transferred to a connected participant' },
    ]);
    expect(transacciones()).toHaveLength(0);
  });

  it('rechaza ceder a alguien que no está en la sala', async () => {
    escenarioBase();

    await ceder('zoe');

    expect(erroresDe(enviados)).toEqual([
      { type: 'error', message: 'Moderation can only be transferred to a connected participant' },
    ]);
    expect(transacciones()).toHaveLength(0);
  });

  it('rechaza cedérsela a sí mismo', async () => {
    escenarioBase();

    await ceder('ana');

    expect(erroresDe(enviados)).toEqual([
      { type: 'error', message: 'Cannot transfer moderation to yourself' },
    ]);
    expect(transacciones()).toHaveLength(0);
  });

  it('avisa el rechazo y no difunde nada si la transacción se cancela', async () => {
    escenarioBase();
    ddbMock
      .on(TransactWriteCommand)
      .rejects(Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException' }));

    await ceder('beto');

    expect(erroresDe(enviados)).toEqual([
      { type: 'error', message: 'Moderation could not be transferred' },
    ]);
    expect(enviados.some((e) => e.message.type === 'roomState')).toBe(false);
  });

  it('rechaza si la sala no existe', async () => {
    escenarioBase();
    ddbMock
      .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
      .resolves({});

    await ceder('beto');

    expect(erroresDe(enviados)).toEqual([{ type: 'error', message: 'Room not found' }]);
    expect(transacciones()).toHaveLength(0);
  });
});
