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

const defaultWebSocketFactory: WebSocketFactory = (url) =>
  new WebSocket(url) as unknown as WebSocketLike;

export class RoomClient {
  private socket: WebSocketLike | null = null;
  private pendingMessages: ClientRequest[] = [];

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

    this.socket = this.webSocketFactory(this.config.websocketUrl);

    this.socket.addEventListener('open', () => {
      this.connectedSubject.next(true);
      for (const message of this.pendingMessages) {
        this.socket?.send(JSON.stringify(message));
      }
      this.pendingMessages = [];
    });

    this.socket.addEventListener('close', () => {
      this.connectedSubject.next(false);
    });

    this.socket.addEventListener('message', (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      this.handleMessage(message);
    });
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'roomState':
        this.roomSubject.next(message.room);
        this.joinRejectedReasonSubject.next(null);
        break;
      case 'roomInfo':
        this.roomInfoSubject.next(message);
        this.joinRejectedReasonSubject.next(null);
        break;
      case 'joinRejected':
        this.joinRejectedReasonSubject.next(message.reason);
        break;
      case 'roomClosed':
        this.roomSummarySubject.next(message.summary);
        this.sessionStore.clear();
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

  saveSession(roomId: string, name: string): void {
    this.myNameSubject.next(name);
    this.sessionStore.save(roomId, name);
  }

  clearSession(): void {
    this.sessionStore.clear();
  }

  hasSessionFor(roomId: string): boolean {
    return this.sessionStore.get(roomId) !== null;
  }

  rejoinIfNeeded(roomId: string): void {
    if (this.roomSubject.value) return;

    const session = this.sessionStore.get(roomId);
    if (!session) return;

    this.myNameSubject.next(session.name);
    this.connect();
    this.send({ action: 'joinRoom', roomId: session.roomId, name: session.name });
  }
}
