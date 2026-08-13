import { PutCommand, QueryCommand, UpdateCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { LOCAL_ENDPOINT, MensajeEnviado, capturarMensajes, claveDeAlta } from './action.fixtures';
import { handleCreateRoom } from './create-room';

const ddbMock = mockClient(DynamoDBDocumentClient);
const CONNECTION_ID = 'conn-ana';

let enviados: MensajeEnviado[] = [];

function escenarioBase() {
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(UpdateCommand).resolves({});
  ddbMock.on(QueryCommand).resolves({ Items: [] });
}

/** El `PutCommand` que crea la sala, distinguido del que crea al participante. */
function altaDeSala() {
  return ddbMock.commandCalls(PutCommand).find((call) => claveDeAlta(call) === 'META')?.args[0].input
    .Item;
}

function altaDeModerador() {
  return ddbMock
    .commandCalls(PutCommand)
    .find((call) => claveDeAlta(call).startsWith('PARTICIPANT#'))?.args[0].input.Item;
}

const pedidoBase = {
  action: 'createRoom' as const,
  moderatorName: 'ana',
  deckId: 'fibonacci',
  moderatorIsVoter: true,
};

beforeEach(() => {
  ddbMock.reset();
  enviados = capturarMensajes();
});

describe('handleCreateRoom', () => {
  it('crea la sala en estado inicial, sin historia ni resultados', async () => {
    escenarioBase();

    await handleCreateRoom(LOCAL_ENDPOINT, CONNECTION_ID, pedidoBase);

    expect(altaDeSala()).toMatchObject({
      deckId: 'fibonacci',
      moderatorName: 'ana',
      moderatorIsVoter: true,
      roundPhase: 'idle',
      currentStoryTitle: null,
      resolvedStories: [],
      revealResult: null,
    });
  });

  it('da de alta al moderador como participante conectado', async () => {
    escenarioBase();

    await handleCreateRoom(LOCAL_ENDPOINT, CONNECTION_ID, pedidoBase);

    expect(altaDeModerador()).toMatchObject({
      name: 'ana',
      connectionId: CONNECTION_ID,
      isModerator: true,
      isVoter: true,
      connected: true,
      vote: null,
    });
  });

  it('respeta que el moderador se cree como no votante', async () => {
    escenarioBase();

    await handleCreateRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
      ...pedidoBase,
      moderatorIsVoter: false,
    });

    expect(altaDeSala()).toMatchObject({ moderatorIsVoter: false });
    expect(altaDeModerador()).toMatchObject({ isVoter: false });
  });

  it('responde con el estado de la sala recién creada', async () => {
    escenarioBase();

    await handleCreateRoom(LOCAL_ENDPOINT, CONNECTION_ID, pedidoBase);

    expect(enviados[0].message).toMatchObject({ type: 'roomState' });
  });

  describe('ícono del moderador', () => {
    it('lo acepta si pertenece al grupo elegido', async () => {
      escenarioBase();

      await handleCreateRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        ...pedidoBase,
        iconGroupId: 'animals',
        icon: '🦊',
      });

      expect(altaDeModerador()).toMatchObject({ icon: '🦊' });
      expect(altaDeSala()).toMatchObject({ iconGroupId: 'animals' });
    });

    it('lo descarta si no pertenece al grupo elegido', async () => {
      escenarioBase();

      await handleCreateRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        ...pedidoBase,
        iconGroupId: 'emotions',
        icon: '🦊',
      });

      expect(altaDeModerador()).toMatchObject({ icon: null });
    });

    // Pedir un ícono sin elegir grupo no rompe: simplemente no hay grupo contra el cual
    // validarlo, así que la sala queda sin íconos.
    it('ignora el ícono si no se eligió grupo', async () => {
      escenarioBase();

      await handleCreateRoom(LOCAL_ENDPOINT, CONNECTION_ID, { ...pedidoBase, icon: '🦊' });

      expect(altaDeSala()).toMatchObject({ iconGroupId: null });
      expect(altaDeModerador()).toMatchObject({ icon: null });
    });
  });
});
