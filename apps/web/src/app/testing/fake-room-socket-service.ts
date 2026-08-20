import { signal } from '@angular/core';
import { ClientRequest, Room, RoomInfoMessage, RoomSummary } from 'shared-contracts';

// Fake mínimo de RoomSocketService para tests de componentes: expone la misma forma
// pública (signals + métodos), sin pasar por RoomClient ni WebSocket real. hasSessionFor/
// rejoinIfNeeded ya tienen 11 tests propios en room-client-runtime — acá solo hace falta
// configurar el retorno y registrar llamadas, no reimplementar la lógica.
export class FakeRoomSocketService {
  readonly room = signal<Room | null>(null);
  readonly roomInfo = signal<RoomInfoMessage | null>(null);
  readonly joinRejectedReason = signal<'name-taken' | 'room-not-found' | null>(null);
  readonly roomSummary = signal<RoomSummary | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly connected = signal(false);
  readonly myName = signal<string | null>(null);

  hasSessionForResult = false;
  readonly rejoinIfNeededCalls: string[] = [];
  readonly sendCalls: ClientRequest[] = [];

  hasSessionFor(_roomId: string): boolean {
    return this.hasSessionForResult;
  }

  rejoinIfNeeded(roomId: string): void {
    this.rejoinIfNeededCalls.push(roomId);
  }

  connect(): void {
    // no-op: el fake nunca abre un WebSocket real.
  }

  send(request: ClientRequest): void {
    this.sendCalls.push(request);
  }

  generateParticipantId(): string {
    return 'fake-participant-id';
  }

  saveSession(_roomId: string, _name: string, _participantId: string): void {
    // no-op: nada en el fake depende de persistir la sesión.
  }

  clearSession(): void {
    // no-op: nada en el fake depende de borrar la sesión.
  }
}
