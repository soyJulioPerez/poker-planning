import { Injectable, signal } from '@angular/core';
import { ClientRequest, Room, RoomSummary, ServerMessage } from 'shared-contracts';

const WEBSOCKET_URL = 'ws://localhost:3001';

@Injectable({ providedIn: 'root' })
export class RoomSocketService {
  private socket: WebSocket | null = null;
  private pendingMessages: ClientRequest[] = [];

  readonly room = signal<Room | null>(null);
  readonly joinRejectedReason = signal<'name-taken' | 'room-not-found' | null>(null);
  readonly roomSummary = signal<RoomSummary | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly connected = signal(false);

  connect(): void {
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) return;

    this.socket = new WebSocket(WEBSOCKET_URL);

    this.socket.addEventListener('open', () => {
      this.connected.set(true);
      for (const message of this.pendingMessages) {
        this.socket?.send(JSON.stringify(message));
      }
      this.pendingMessages = [];
    });

    this.socket.addEventListener('close', () => {
      this.connected.set(false);
    });

    this.socket.addEventListener('message', (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      this.handleMessage(message);
    });
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'roomState':
        this.room.set(message.room);
        this.joinRejectedReason.set(null);
        break;
      case 'joinRejected':
        this.joinRejectedReason.set(message.reason);
        break;
      case 'roomClosed':
        this.roomSummary.set(message.summary);
        break;
      case 'error':
        this.errorMessage.set(message.message);
        break;
    }
  }

  send(request: ClientRequest): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(request));
    } else {
      this.pendingMessages.push(request);
      this.connect();
    }
  }
}
