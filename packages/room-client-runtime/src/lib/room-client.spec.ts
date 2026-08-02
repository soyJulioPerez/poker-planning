import { RoomClient, WebSocketLike } from './room-client';
import { SessionStore, StoredSession } from './session-store';

class FakeWebSocket implements WebSocketLike {
  readyState = 0; // CONNECTING
  sent: string[] = [];
  private listeners: { open: (() => void)[]; close: (() => void)[]; message: ((event: { data: string }) => void)[] } =
    { open: [], close: [], message: [] };

  addEventListener(type: 'open' | 'close', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: { data: string }) => void): void;
  addEventListener(type: 'open' | 'close' | 'message', listener: any): void {
    this.listeners[type].push(listener);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  triggerOpen(): void {
    this.readyState = 1; // OPEN
    this.listeners.open.forEach((l) => l());
  }

  triggerClose(): void {
    this.readyState = 3; // CLOSED
    this.listeners.close.forEach((l) => l());
  }

  triggerMessage(data: unknown): void {
    this.listeners.message.forEach((l) => l({ data: JSON.stringify(data) }));
  }
}

class InMemorySessionStore implements SessionStore {
  private session: StoredSession | null = null;

  get(roomId: string): StoredSession | null {
    if (!this.session || this.session.roomId !== roomId) return null;
    return this.session;
  }

  save(roomId: string, name: string): void {
    this.session = { roomId, name };
  }

  clear(): void {
    this.session = null;
  }
}

function createClient() {
  const sockets: FakeWebSocket[] = [];
  const sessionStore = new InMemorySessionStore();
  const client = new RoomClient({ websocketUrl: 'wss://example.test' }, sessionStore, () => {
    const socket = new FakeWebSocket();
    sockets.push(socket);
    return socket;
  });
  return { client, sockets, sessionStore };
}

describe('RoomClient', () => {
  it('encola un mensaje enviado con el socket cerrado y lo despacha al abrir la conexión', () => {
    const { client, sockets } = createClient();

    client.send({ action: 'getRoomInfo', roomId: 'ABC123' });

    expect(sockets).toHaveLength(1);
    expect(sockets[0].sent).toHaveLength(0);

    sockets[0].triggerOpen();

    expect(sockets[0].sent).toEqual([JSON.stringify({ action: 'getRoomInfo', roomId: 'ABC123' })]);
  });

  it('envia inmediatamente un mensaje cuando el socket ya esta abierto', () => {
    const { client, sockets } = createClient();

    client.send({ action: 'getRoomInfo', roomId: 'ABC123' });
    sockets[0].triggerOpen();
    sockets[0].sent = [];

    client.send({ action: 'vote', roomId: 'ABC123', value: '5' });

    expect(sockets[0].sent).toEqual([JSON.stringify({ action: 'vote', roomId: 'ABC123', value: '5' })]);
  });

  it('roomState actualiza room y limpia joinRejectedReason', () => {
    const { client, sockets } = createClient();
    client.connect();

    const room = { id: 'ABC123' } as never;
    sockets[0].triggerMessage({ type: 'joinRejected', reason: 'name-taken' });
    sockets[0].triggerMessage({ type: 'roomState', room });

    expect(client.room$).toBeDefined();
    let latestRoom: unknown;
    let latestReason: unknown;
    client.room$.subscribe((r) => (latestRoom = r));
    client.joinRejectedReason$.subscribe((r) => (latestReason = r));

    expect(latestRoom).toEqual(room);
    expect(latestReason).toBeNull();
  });

  it('joinRejected no pisa el ultimo room emitido', () => {
    const { client, sockets } = createClient();
    client.connect();

    const room = { id: 'ABC123' } as never;
    sockets[0].triggerMessage({ type: 'roomState', room });
    sockets[0].triggerMessage({ type: 'joinRejected', reason: 'name-taken' });

    let latestRoom: unknown;
    let latestReason: unknown;
    client.room$.subscribe((r) => (latestRoom = r));
    client.joinRejectedReason$.subscribe((r) => (latestReason = r));

    expect(latestRoom).toEqual(room);
    expect(latestReason).toBe('name-taken');
  });

  it('roomClosed limpia la sesion persistida', () => {
    const { client, sockets, sessionStore } = createClient();
    sessionStore.save('ABC123', 'Julio');
    client.connect();

    sockets[0].triggerMessage({ type: 'roomClosed', summary: { id: 'ABC123' } });

    expect(sessionStore.get('ABC123')).toBeNull();
  });

  it('reingresa automaticamente cuando hay sesion guardada y no hay room cargado', () => {
    const { client, sockets, sessionStore } = createClient();
    sessionStore.save('ABC123', 'Julio');

    client.rejoinIfNeeded('ABC123');
    sockets[0].triggerOpen();

    expect(sockets[0].sent).toEqual([
      JSON.stringify({ action: 'joinRoom', roomId: 'ABC123', name: 'Julio' }),
    ]);
  });

  it('no reingresa si ya hay estado de sala cargado', () => {
    const { client, sockets, sessionStore } = createClient();
    sessionStore.save('ABC123', 'Julio');
    client.connect();
    sockets[0].triggerMessage({ type: 'roomState', room: { id: 'ABC123' } });

    client.rejoinIfNeeded('ABC123');

    expect(sockets).toHaveLength(1);
    expect(sockets[0].sent).toEqual([]);
  });

  it('no reingresa ni se conecta sin sesion guardada', () => {
    const { client, sockets } = createClient();

    client.rejoinIfNeeded('ABC123');

    expect(sockets).toHaveLength(0);
  });

  it('saveSession actualiza myName y persiste la sesion', () => {
    const { client, sessionStore } = createClient();

    client.saveSession('ABC123', 'Julio');

    let latestName: unknown;
    client.myName$.subscribe((n) => (latestName = n));
    expect(latestName).toBe('Julio');
    expect(sessionStore.get('ABC123')).toEqual({ roomId: 'ABC123', name: 'Julio' });
  });

  it('el reingreso actualiza myName antes de enviar joinRoom', () => {
    const { client, sockets, sessionStore } = createClient();
    sessionStore.save('ABC123', 'Julio');

    client.rejoinIfNeeded('ABC123');

    let latestName: unknown;
    client.myName$.subscribe((n) => (latestName = n));
    expect(latestName).toBe('Julio');
    sockets[0].triggerOpen();
    expect(sockets[0].sent).toEqual([
      JSON.stringify({ action: 'joinRoom', roomId: 'ABC123', name: 'Julio' }),
    ]);
  });
});
