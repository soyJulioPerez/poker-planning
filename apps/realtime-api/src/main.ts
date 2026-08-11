import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { DeleteCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, connectionKey, participantKey, nowPlusTtl } from './lib/dynamo-client';
import { buildRoomState, maskRoomForViewer } from './lib/room-repository';
import { registerLocalTransport, broadcastRoomState } from './lib/broadcast';
import { handleCreateRoom } from './actions/create-room';
import { handleJoinRoom } from './actions/join-room';
import { handleGetRoomInfo } from './actions/get-room-info';
import { handleVote } from './actions/vote';
import { handleReveal } from './actions/reveal';
import { handleResolveStory } from './actions/resolve-story';
import { handleNewRound } from './actions/new-round';
import { handleNextStory } from './actions/next-story';
import { handleSetModeratorIsVoter } from './actions/set-moderator-is-voter';
import { handleCloseRoom } from './actions/close-room';
import { ClientRequest, ServerMessage } from 'shared-contracts';

const PORT = Number(process.env.PORT ?? 3001);
const LOCAL_API_ENDPOINT = 'local://dev';

const connections = new Map<string, WebSocket>();

// Este emulador local reimplementa lo que en AWS hacen los handlers de Lambda, y hasta
// ahora no logueaba nada: cuando la suite e2e fallaba en CI no habia forma de saber si el
// mensaje habia llegado, si DynamoDB habia respondido, ni cuanto habia tardado. Se paso
// tres corridas del pipeline diagnosticando a ciegas antes de agregar esto.
//
// JSON de una linea, en la direccion que pide la Fase 4.1 del roadmap.
function log(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...fields }));
}

registerLocalTransport((connectionId, message) => {
  const socket = connections.get(connectionId);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
});

// `UpdateCommand` y no `PutCommand`: acá había una carrera real, visible en los logs de
// una corrida que pasa.
//
// Esta función es fire-and-forget (`handleConnect(...)` sin await en el `connection`), y
// el cliente encola su primer mensaje y lo manda apenas abre el socket. O sea que
// `handleCreateRoom` puede correr ANTES de que esto termine — medido: el `createRoom`
// llega 38ms después de abrir y esta escritura tarda ~200ms la primera vez.
//
// `handleCreateRoom` hace un `UpdateCommand` sobre esta misma fila para grabarle `roomId`
// y `name`. Con un `Put`, que reemplaza el item entero, si esta escritura aterrizaba
// segunda **borraba esos dos campos**. Y sin ellos `handleDisconnect` no encuentra a qué
// sala pertenece la conexión, así que no marca al participante como desconectado ni avisa
// a la sala: el participante se queda "conectado" para siempre.
//
// Con `Update` las dos escrituras componen en vez de pisarse, en cualquier orden.
//
// En AWS no aplica: API Gateway garantiza que `$connect` termine antes de entregar
// mensajes. Es un problema propio de este emulador, donde esa garantía no existe.
async function handleConnect(connectionId: string): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: connectionKey(connectionId),
      UpdateExpression: 'SET connectedAt = :connectedAt, #ttl = :ttl',
      ExpressionAttributeNames: { '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':connectedAt': Date.now(), ':ttl': nowPlusTtl() },
    })
  );
}

async function handleDisconnect(connectionId: string): Promise<void> {
  const connection = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: connectionKey(connectionId) })
  );
  const roomId = connection.Item?.['roomId'] as string | undefined;
  const name = connection.Item?.['name'] as string | undefined;

  if (roomId && name) {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: participantKey(roomId, name),
        UpdateExpression: 'SET connected = :false',
        ExpressionAttributeValues: { ':false': false },
      })
    );

    try {
      const room = await buildRoomState(roomId);
      if (room) {
        await broadcastRoomState(LOCAL_API_ENDPOINT, room, maskRoomForViewer);
      }
    } catch {
      // best-effort
    }
  }

  await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: connectionKey(connectionId) }));
}

function sendLocal(connectionId: string, message: ServerMessage): void {
  const socket = connections.get(connectionId);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (socket) => {
  const connectionId = randomUUID();
  connections.set(connectionId, socket);

  // `handleConnect` escribe la fila de conexion en DynamoDB y es fire-and-forget: si
  // fallaba, el error se perdia por completo y el sintoma aparecia mucho despues, como
  // una accion que nunca responde. Ahora al menos queda registrado, con cuanto tardo.
  const connectStarted = Date.now();
  log('connection.open', { connectionId });
  handleConnect(connectionId).then(
    () => log('connection.registered', { connectionId, durationMs: Date.now() - connectStarted }),
    (error) =>
      log('connection.register_failed', {
        connectionId,
        durationMs: Date.now() - connectStarted,
        error: error instanceof Error ? error.message : String(error),
      })
  );

  socket.on('message', async (data) => {
    let request: ClientRequest;
    try {
      request = JSON.parse(data.toString());
    } catch {
      sendLocal(connectionId, { type: 'error', message: 'Invalid message payload' });
      return;
    }

    const started = Date.now();
    log('action.received', { connectionId, action: request.action });

    try {
      switch (request.action) {
        case 'createRoom':
          await handleCreateRoom(LOCAL_API_ENDPOINT, connectionId, request);
          break;
        case 'joinRoom':
          await handleJoinRoom(LOCAL_API_ENDPOINT, connectionId, request);
          break;
        case 'getRoomInfo':
          await handleGetRoomInfo(LOCAL_API_ENDPOINT, connectionId, request);
          break;
        case 'vote':
          await handleVote(LOCAL_API_ENDPOINT, connectionId, request);
          break;
        case 'reveal':
          await handleReveal(LOCAL_API_ENDPOINT, connectionId, request);
          break;
        case 'resolveStory':
          await handleResolveStory(LOCAL_API_ENDPOINT, connectionId, request);
          break;
        case 'newRound':
          await handleNewRound(LOCAL_API_ENDPOINT, connectionId, request);
          break;
        case 'nextStory':
          await handleNextStory(LOCAL_API_ENDPOINT, connectionId, request);
          break;
        case 'setModeratorIsVoter':
          await handleSetModeratorIsVoter(LOCAL_API_ENDPOINT, connectionId, request);
          break;
        case 'closeRoom':
          await handleCloseRoom(LOCAL_API_ENDPOINT, connectionId, request);
          break;
        default:
          sendLocal(connectionId, {
            type: 'error',
            message: `Unsupported action: ${(request as { action?: string }).action}`,
          });
      }
      log('action.done', {
        connectionId,
        action: request.action,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      log('action.failed', {
        connectionId,
        action: request.action,
        durationMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      sendLocal(connectionId, {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  socket.on('close', () => {
    connections.delete(connectionId);
    log('connection.close', { connectionId });
    handleDisconnect(connectionId).catch((error) =>
      log('connection.cleanup_failed', {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  });
});

// Incluye la config de DynamoDB para poder confirmar que las variables de entorno
// llegaron al proceso — en CI las inyecta el `webServer` de Playwright.
// `address` incluye la familia (IPv4/IPv6) a la que quedo bindeado el socket. Importa:
// el navegador resuelve `localhost` por su cuenta y si elige la familia que el servidor
// no atiende, la conexion se cuelga sin que al backend le llegue nada.
log('server.listening', {
  url: `ws://localhost:${PORT}`,
  address: wss.address(),
  table: TABLE_NAME,
  dynamoEndpoint: process.env.DYNAMODB_ENDPOINT ?? '(default AWS)',
  region: process.env.AWS_REGION ?? '(sin definir)',
});
