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
import { handleClaimModeration } from './claim-moderation';

const ddbMock = mockClient(DynamoDBDocumentClient);
const CONNECTION_ID = 'conn-beto';
const AHORA = 1_700_000_000_000;

let enviados: MensajeEnviado[] = [];

/** Por defecto Ana (la moderadora) se cayó hace 61 segundos y Beto pide la moderación. */
function escenarioBase(
  anaOverrides: Record<string, unknown> = { connected: false, disconnectedAt: AHORA - 61_000 },
  quienPide = 'beto'
) {
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `CONN#${CONNECTION_ID}`, SK: 'META' } })
    .resolves({ Item: { name: quienPide } });
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
    .resolves({ Item: salaFixture() });
  ddbMock
    .on(QueryCommand)
    .resolves({ Items: [participanteFixture('ana', anaOverrides), participanteFixture('beto')] });
  ddbMock.on(TransactWriteCommand).resolves({});
}

function transacciones() {
  return ddbMock.commandCalls(TransactWriteCommand);
}

function escriturasDeLaTransaccion() {
  const items = transacciones()[0].args[0].input.TransactItems ?? [];
  return Object.fromEntries(items.map((item) => [String(item.Update?.Key?.['SK']), item.Update]));
}

function tomar() {
  return handleClaimModeration(LOCAL_ENDPOINT, CONNECTION_ID, {
    action: 'claimModeration',
    roomId: ROOM_ID,
  });
}

beforeEach(() => {
  ddbMock.reset();
  enviados = capturarMensajes();
  jest.spyOn(Date, 'now').mockReturnValue(AHORA);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('handleClaimModeration', () => {
  it('toma la moderación si la moderadora lleva más de 60 segundos caída', async () => {
    escenarioBase();

    await tomar();

    expect(transacciones()).toHaveLength(1);
    const escrituras = escriturasDeLaTransaccion();
    expect(escrituras['META']?.ExpressionAttributeValues).toMatchObject({
      ':next': 'beto',
      ':previous': 'ana',
    });
    expect(escrituras['PARTICIPANT#beto']?.UpdateExpression).toBe(
      'SET isModerator = :true, isVoter = :true'
    );
    expect(escrituras['PARTICIPANT#ana']?.UpdateExpression).toBe(
      'SET isModerator = :false, isVoter = :true'
    );
    expect(enviados.some((e) => e.message.type === 'roomState')).toBe(true);
    expect(erroresDe(enviados)).toEqual([]);
  });

  // La lectura de arriba puede quedar vieja: si Ana vuelve entre la lectura y la escritura,
  // la condición de la transacción es la que impide sacarle el rol.
  it('repite en la transacción la condición de que la moderadora siga caída desde antes del plazo', async () => {
    escenarioBase();

    await tomar();

    const anterior = escriturasDeLaTransaccion()['PARTICIPANT#ana'];
    expect(anterior?.ConditionExpression).toContain('connected = :false');
    expect(anterior?.ConditionExpression).toContain('disconnectedAt <= :disconnectedBefore');
    expect(anterior?.ExpressionAttributeValues?.[':disconnectedBefore']).toBe(AHORA - 60_000);
  });

  it('no toca la ronda: ni fase, ni historia, ni votos', async () => {
    escenarioBase();

    await tomar();

    const expresiones = Object.values(escriturasDeLaTransaccion()).map((u) => u?.UpdateExpression);
    for (const expresion of expresiones) {
      expect(expresion).not.toMatch(/roundPhase|currentStoryTitle|vote|revealResult/);
    }
  });

  it('rechaza si la moderadora lleva menos de 60 segundos caída', async () => {
    escenarioBase({ connected: false, disconnectedAt: AHORA - 30_000 });

    await tomar();

    expect(erroresDe(enviados)).toEqual([
      { type: 'error', message: 'The moderator has not been disconnected long enough' },
    ]);
    expect(transacciones()).toHaveLength(0);
  });

  it('rechaza si la moderadora sigue conectada', async () => {
    escenarioBase({ connected: true });

    await tomar();

    expect(erroresDe(enviados)).toEqual([
      { type: 'error', message: 'The moderator is still connected' },
    ]);
    expect(transacciones()).toHaveLength(0);
  });

  // Desconectada antes del deploy que agregó `disconnectedAt`: no hay forma de saber hace
  // cuánto, y tratarla como recién caída la dejaría trabada para siempre.
  it('permite tomarla si la moderadora está caída sin marca de tiempo (registro previo)', async () => {
    escenarioBase({ connected: false });

    await tomar();

    expect(transacciones()).toHaveLength(1);
    expect(erroresDe(enviados)).toEqual([]);
  });

  it('rechaza si quien pide ya es el moderador', async () => {
    escenarioBase(undefined, 'ana');

    await tomar();

    expect(erroresDe(enviados)).toEqual([{ type: 'error', message: 'You are already the moderator' }]);
    expect(transacciones()).toHaveLength(0);
  });

  it('rechaza si quien pide no está en la sala', async () => {
    escenarioBase(undefined, 'zoe');

    await tomar();

    expect(erroresDe(enviados)).toEqual([
      { type: 'error', message: 'Only connected participants can claim moderation' },
    ]);
    expect(transacciones()).toHaveLength(0);
  });

  // Dos participantes apretaron "Tomar moderación" a la vez: el segundo encuentra que
  // `moderatorName` ya no es Ana y DynamoDB cancela su transacción.
  it('avisa el rechazo y no difunde nada si otro la tomó primero', async () => {
    escenarioBase();
    ddbMock
      .on(TransactWriteCommand)
      .rejects(Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException' }));

    await tomar();

    expect(erroresDe(enviados)).toEqual([
      { type: 'error', message: 'Moderation could not be claimed' },
    ]);
    expect(enviados.some((e) => e.message.type === 'roomState')).toBe(false);
  });

  it('rechaza si la sala no existe', async () => {
    escenarioBase();
    ddbMock
      .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
      .resolves({});

    await tomar();

    expect(erroresDe(enviados)).toEqual([{ type: 'error', message: 'Room not found' }]);
    expect(transacciones()).toHaveLength(0);
  });
});
