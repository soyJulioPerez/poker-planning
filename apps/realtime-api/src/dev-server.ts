import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { PutCommand, DeleteCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, connectionKey, participantKey, nowPlusTtl } from './lib/dynamo-client';
import { buildRoomState } from './lib/room-repository';
import { registerLocalTransport } from './lib/broadcast';
import { handleCreateRoom } from './actions/create-room';
import { handleJoinRoom } from './actions/join-room';
import { ClientRequest, ServerMessage } from 'shared-contracts';

const PORT = Number(process.env.PORT ?? 3001);
const LOCAL_API_ENDPOINT = 'local://dev';

const connections = new Map<string, WebSocket>();

registerLocalTransport((connectionId, message) => {
  const socket = connections.get(connectionId);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
});

async function handleConnect(connectionId: string): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...connectionKey(connectionId), connectedAt: Date.now(), ttl: nowPlusTtl() },
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
        for (const [otherConnectionId, socket] of connections) {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'roomState', room } satisfies ServerMessage));
          }
          void otherConnectionId;
        }
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
  void handleConnect(connectionId);

  socket.on('message', async (data) => {
    let request: ClientRequest;
    try {
      request = JSON.parse(data.toString());
    } catch {
      sendLocal(connectionId, { type: 'error', message: 'Invalid message payload' });
      return;
    }

    try {
      switch (request.action) {
        case 'createRoom':
          await handleCreateRoom(LOCAL_API_ENDPOINT, connectionId, request);
          break;
        case 'joinRoom':
          await handleJoinRoom(LOCAL_API_ENDPOINT, connectionId, request);
          break;
        default:
          sendLocal(connectionId, {
            type: 'error',
            message: `Unsupported action: ${(request as { action?: string }).action}`,
          });
      }
    } catch (error) {
      sendLocal(connectionId, {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  socket.on('close', () => {
    connections.delete(connectionId);
    void handleDisconnect(connectionId);
  });
});

console.log(`Local WebSocket dev server listening on ws://localhost:${PORT}`);
