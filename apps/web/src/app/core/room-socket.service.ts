import { Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RoomClient } from 'room-client-runtime';
import { ClientRequest } from 'shared-contracts';
import { environment } from '../../environments/environment';
import { BrowserSessionStore } from './room-session-store';

@Injectable({ providedIn: 'root' })
export class RoomSocketService {
  private readonly client = new RoomClient({ websocketUrl: environment.wsUrl }, new BrowserSessionStore());

  readonly room = toSignal(this.client.room$, { initialValue: null });
  readonly roomInfo = toSignal(this.client.roomInfo$, { initialValue: null });
  readonly joinRejectedReason = toSignal(this.client.joinRejectedReason$, { initialValue: null });
  readonly roomSummary = toSignal(this.client.roomSummary$, { initialValue: null });
  readonly errorMessage = toSignal(this.client.errorMessage$, { initialValue: null });
  readonly connected = toSignal(this.client.connected$, { initialValue: false });

  // Writable (no toSignal): los componentes lo asignan de forma optimista
  // antes de que el servidor confirme la sala (ver home.ts createRoom/joinRoom).
  readonly myName = signal<string | null>(null);

  constructor() {
    this.client.myName$.subscribe((name) => {
      if (name !== null) this.myName.set(name);
    });
  }

  connect(): void {
    this.client.connect();
  }

  send(request: ClientRequest): void {
    this.client.send(request);
  }

  saveSession(roomId: string, name: string): void {
    this.client.saveSession(roomId, name);
  }

  clearSession(): void {
    this.client.clearSession();
  }

  hasSessionFor(roomId: string): boolean {
    return this.client.hasSessionFor(roomId);
  }

  rejoinIfNeeded(roomId: string): void {
    this.client.rejoinIfNeeded(roomId);
  }
}
