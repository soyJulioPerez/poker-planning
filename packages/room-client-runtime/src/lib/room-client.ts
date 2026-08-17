import { BehaviorSubject, Observable } from 'rxjs';
import { ClientRequest, Room, RoomInfoMessage, RoomSummary, ServerMessage } from 'shared-contracts';
import { RoomClientConfig } from './room-client-config';
import { SessionStore } from './session-store';

export interface WebSocketLike {
  readyState: number;
  addEventListener(type: 'open' | 'close', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: { data: string }) => void): void;
  send(data: string): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

const OPEN_STATE = 1;
const CLOSED_STATE = 3;

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 10000;

const defaultWebSocketFactory: WebSocketFactory = (url) =>
  new WebSocket(url) as unknown as WebSocketLike;

export class RoomClient {
  private socket: WebSocketLike | null = null;
  private pendingMessages: ClientRequest[] = [];

  // Sala a la que el runtime está intentando pertenecer ahora mismo — distinta del `roomId`
  // de un `rejoinIfNeeded` puntual: se usa para saber, en cualquier cierre de conexión
  // posterior, si corresponde reintentar automáticamente.
  private activeRoomId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingJoinConfirmation = false;

  private readonly roomSubject = new BehaviorSubject<Room | null>(null);
  private readonly roomInfoSubject = new BehaviorSubject<RoomInfoMessage | null>(null);
  private readonly joinRejectedReasonSubject = new BehaviorSubject<'name-taken' | 'room-not-found' | null>(null);
  private readonly roomSummarySubject = new BehaviorSubject<RoomSummary | null>(null);
  private readonly errorMessageSubject = new BehaviorSubject<string | null>(null);
  private readonly connectedSubject = new BehaviorSubject(false);
  private readonly myNameSubject = new BehaviorSubject<string | null>(null);

  readonly room$: Observable<Room | null> = this.roomSubject.asObservable();
  readonly roomInfo$: Observable<RoomInfoMessage | null> = this.roomInfoSubject.asObservable();
  readonly joinRejectedReason$: Observable<'name-taken' | 'room-not-found' | null> =
    this.joinRejectedReasonSubject.asObservable();
  readonly roomSummary$: Observable<RoomSummary | null> = this.roomSummarySubject.asObservable();
  readonly errorMessage$: Observable<string | null> = this.errorMessageSubject.asObservable();
  readonly connected$: Observable<boolean> = this.connectedSubject.asObservable();
  readonly myName$: Observable<string | null> = this.myNameSubject.asObservable();

  constructor(
    private readonly config: RoomClientConfig,
    private readonly sessionStore: SessionStore,
    private readonly webSocketFactory: WebSocketFactory = defaultWebSocketFactory,
  ) {}

  connect(): void {
    if (this.socket && this.socket.readyState !== CLOSED_STATE) return;

    this.log('connection.connecting', { url: this.config.websocketUrl });
    this.socket = this.webSocketFactory(this.config.websocketUrl);

    this.socket.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      this.connectedSubject.next(true);
      this.log('connection.open');
      for (const message of this.pendingMessages) {
        this.socket?.send(JSON.stringify(message));
      }
      this.pendingMessages = [];
    });

    this.socket.addEventListener('close', () => {
      this.connectedSubject.next(false);
      this.warn('connection.closed');
      this.scheduleReconnect();
    });

    this.socket.addEventListener('message', (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      this.handleMessage(message);
    });
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'roomState':
        if (this.awaitingJoinConfirmation) {
          this.awaitingJoinConfirmation = false;
          this.log('rejoin.accepted', { roomId: message.room.roomId });
        }
        this.roomSubject.next(message.room);
        this.joinRejectedReasonSubject.next(null);
        break;
      case 'roomInfo':
        this.roomInfoSubject.next(message);
        this.joinRejectedReasonSubject.next(null);
        break;
      case 'joinRejected':
        if (this.awaitingJoinConfirmation) {
          this.awaitingJoinConfirmation = false;
          this.warn('rejoin.rejected', { reason: message.reason });
        }
        this.joinRejectedReasonSubject.next(message.reason);
        break;
      case 'roomClosed':
        this.roomSummarySubject.next(message.summary);
        this.sessionStore.clear();
        this.activeRoomId = null;
        this.clearScheduledReconnect();
        break;
      case 'error':
        this.errorMessageSubject.next(message.message);
        break;
    }
  }

  send(request: ClientRequest): void {
    if (this.socket?.readyState === OPEN_STATE) {
      this.socket.send(JSON.stringify(request));
    } else {
      this.pendingMessages.push(request);
      this.connect();
    }
  }

  generateParticipantId(): string {
    return crypto.randomUUID();
  }

  saveSession(roomId: string, name: string, participantId: string): void {
    this.myNameSubject.next(name);
    this.activeRoomId = roomId;
    this.sessionStore.save(roomId, name, participantId);
  }

  clearSession(): void {
    this.sessionStore.clear();
    this.activeRoomId = null;
    this.clearScheduledReconnect();
  }

  hasSessionFor(roomId: string): boolean {
    return this.sessionStore.get(roomId) !== null;
  }

  rejoinIfNeeded(roomId: string): void {
    if (this.roomSubject.value) return;
    this.activeRoomId = roomId;
    this.sendJoinForSession(roomId);
  }

  /** El envío real de un `joinRoom` de reingreso — usado tanto por `rejoinIfNeeded` (chequeo
   * de montaje) como por el reintento automático tras un cierre de conexión a mitad de sesión,
   * que no debe frenarse por haber `room` cargado (es precisamente lo que quedó desactualizado). */
  private sendJoinForSession(roomId: string): void {
    const session = this.sessionStore.get(roomId);
    if (!session) return;

    this.myNameSubject.next(session.name);
    this.joinRejectedReasonSubject.next(null);
    this.awaitingJoinConfirmation = true;
    this.log('rejoin.sent', { roomId });
    this.connect();
    this.send({
      action: 'joinRoom',
      roomId: session.roomId,
      name: session.name,
      participantId: session.participantId,
    });
  }

  private scheduleReconnect(): void {
    if (!this.activeRoomId || this.reconnectTimer !== null) return;
    if (!this.sessionStore.get(this.activeRoomId)) return;

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectAttempts++;
    this.warn('connection.reconnect_scheduled', { delayMs: delay });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.activeRoomId) this.sendJoinForSession(this.activeRoomId);
    }, delay);
  }

  private clearScheduledReconnect(): void {
    if (this.reconnectTimer === null) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private log(event: string, details?: Record<string, unknown>): void {
    if (details) console.log(`[room-client] ${event}`, details);
    else console.log(`[room-client] ${event}`);
  }

  private warn(event: string, details?: Record<string, unknown>): void {
    if (details) console.warn(`[room-client] ${event}`, details);
    else console.warn(`[room-client] ${event}`);
  }
}
