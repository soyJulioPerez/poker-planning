import { GetCommand, PutCommand, QueryCommand, UpdateCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { ServerMessage } from 'shared-contracts';
import { registerLocalTransport } from '../lib/broadcast';
import { TABLE_NAME } from '../lib/dynamo-client';
import { handleJoinRoom } from './join-room';

const ddbMock = mockClient(DynamoDBDocumentClient);

const LOCAL_ENDPOINT = 'local://test';
const CONNECTION_ID = 'conn-nueva';
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

function participante(name: string, overrides: Record<string, unknown> = {}) {
  return {
    PK: `ROOM#${ROOM_ID}`,
    SK: `PARTICIPANT#${name}`,
    name,
    connectionId: `conn-vieja-${name}`,
    isModerator: false,
    isVoter: true,
    connected: true,
    vote: null,
    icon: null,
    ...overrides,
  };
}

function escenarioBase(
  metaOverrides: Record<string, unknown> = {},
  participantes: Record<string, unknown>[] = []
) {
  ddbMock
    .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
    .resolves({ Item: meta(metaOverrides) });
  ddbMock.on(QueryCommand).resolves({ Items: participantes });
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(UpdateCommand).resolves({});
}

function rechazos() {
  return enviados.filter((e) => e.message.type === 'joinRejected').map((e) => e.message);
}

/** El `PutCommand` que da de alta —o reincorpora— al participante. */
function altaDeParticipante() {
  return ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item;
}

beforeEach(() => {
  ddbMock.reset();
  enviados = [];
  registerLocalTransport((connectionId, message) => enviados.push({ connectionId, message }));
});

describe('handleJoinRoom', () => {
  describe('participante nuevo', () => {
    it('entra como votante, sin rol de moderador y sin voto', async () => {
      escenarioBase();

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
      });

      expect(altaDeParticipante()).toMatchObject({
        name: 'beto',
        connectionId: CONNECTION_ID,
        isModerator: false,
        isVoter: true,
        connected: true,
        vote: null,
      });
      expect(rechazos()).toEqual([]);
    });
  });

  // Esta es la lógica que cubría el e2e que estuvo marcado `test.fixme` doce días:
  // quien se cae y vuelve no debería perder lo que ya había hecho.
  describe('reconexión de un participante que se había caído', () => {
    it('conserva su voto, para no obligarlo a votar de nuevo', async () => {
      escenarioBase({}, [participante('beto', { connected: false, vote: '8' })]);

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
      });

      expect(altaDeParticipante()).toMatchObject({ vote: '8', connected: true });
    });

    it('conserva su rol de moderador', async () => {
      escenarioBase({ moderatorName: 'beto' }, [
        participante('beto', { connected: false, isModerator: true }),
      ]);

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
      });

      expect(altaDeParticipante()).toMatchObject({ isModerator: true });
    });

    it('conserva su estado de votante', async () => {
      escenarioBase({}, [participante('beto', { connected: false, isVoter: false })]);

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
      });

      expect(altaDeParticipante()).toMatchObject({ isVoter: false });
    });

    it('conserva su ícono, aunque vuelva sin pedir ninguno', async () => {
      escenarioBase({ iconGroupId: 'animals' }, [
        participante('beto', { connected: false, icon: '🦊' }),
      ]);

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
      });

      expect(altaDeParticipante()).toMatchObject({ icon: '🦊' });
    });

    it('actualiza la conexión, que es lo único que cambió', async () => {
      escenarioBase({}, [participante('beto', { connected: false, vote: '8' })]);

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
      });

      expect(altaDeParticipante()).toMatchObject({ connectionId: CONNECTION_ID });
    });
  });

  // La diferencia entre "ese nombre está ocupado" y "sos vos que volvés" es un solo
  // `&& existing.connected`. Los dos tests de acá son el mismo escenario con ese único
  // campo cambiado, a propósito.
  describe('nombre repetido', () => {
    it('lo rechaza si el original sigue conectado', async () => {
      escenarioBase({}, [participante('beto', { connected: true })]);

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
      });

      expect(rechazos()).toEqual([{ type: 'joinRejected', reason: 'name-taken' }]);
      expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
    });

    it('lo acepta si el original está desconectado, porque es una reconexión', async () => {
      escenarioBase({}, [participante('beto', { connected: false })]);

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
      });

      expect(rechazos()).toEqual([]);
      expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
    });
  });

  // La misma sesión (mismo participantId) reingresa siempre, sin importar `connected` — es lo
  // que cierra la carrera contra la limpieza de la conexión anterior. Sin esa coincidencia, el
  // comportamiento es exactamente el del bloque de arriba (no cambia).
  describe('reingreso identificado por participantId', () => {
    it('lo acepta si el participantId coincide, aunque el registro siga marcado como conectado', async () => {
      escenarioBase({}, [
        participante('beto', { connected: true, participantId: 'participant-1', vote: '8' }),
      ]);

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
        participantId: 'participant-1',
      });

      expect(rechazos()).toEqual([]);
      expect(altaDeParticipante()).toMatchObject({ participantId: 'participant-1', vote: '8' });
    });

    it('lo rechaza si el participantId no coincide y el original sigue conectado', async () => {
      escenarioBase({}, [participante('beto', { connected: true, participantId: 'participant-1' })]);

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
        participantId: 'participant-2',
      });

      expect(rechazos()).toEqual([{ type: 'joinRejected', reason: 'name-taken' }]);
      expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
    });

    it('sin participantId de ningún lado, se comporta como un participante legacy (solo mira connected)', async () => {
      escenarioBase({}, [participante('beto', { connected: false })]);

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
      });

      expect(rechazos()).toEqual([]);
      expect(altaDeParticipante()).toMatchObject({ participantId: null });
    });
  });

  describe('ícono', () => {
    it('acepta el pedido si pertenece al grupo de la sala', async () => {
      escenarioBase({ iconGroupId: 'animals' });

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
        icon: '🦊',
      });

      expect(altaDeParticipante()).toMatchObject({ icon: '🦊' });
    });

    it('descarta el pedido si no pertenece al grupo de la sala', async () => {
      // '🦊' es del grupo `animals`; la sala usa `emotions`.
      escenarioBase({ iconGroupId: 'emotions' });

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
        icon: '🦊',
      });

      expect(altaDeParticipante()).toMatchObject({ icon: null });
    });

    it('lo deja en null si la sala no tiene grupo de íconos', async () => {
      escenarioBase({ iconGroupId: null });

      await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
        action: 'joinRoom',
        roomId: ROOM_ID,
        name: 'beto',
        icon: '🦊',
      });

      expect(altaDeParticipante()).toMatchObject({ icon: null });
    });
  });

  it('rechaza si la sala no existe', async () => {
    escenarioBase();
    ddbMock
      .on(GetCommand, { TableName: TABLE_NAME, Key: { PK: `ROOM#${ROOM_ID}`, SK: 'META' } })
      .resolves({});

    await handleJoinRoom(LOCAL_ENDPOINT, CONNECTION_ID, {
      action: 'joinRoom',
      roomId: ROOM_ID,
      name: 'beto',
    });

    expect(rechazos()).toEqual([{ type: 'joinRejected', reason: 'room-not-found' }]);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });
});
