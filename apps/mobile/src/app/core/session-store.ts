import { SessionStore, StoredSession } from 'room-client-runtime';

export class InMemorySessionStore implements SessionStore {
  private session: StoredSession | null = null;

  get(roomId: string): StoredSession | null {
    if (!this.session || this.session.roomId !== roomId) return null;
    return this.session;
  }

  save(roomId: string, name: string, participantId: string): void {
    this.session = { roomId, name, participantId };
  }

  clear(): void {
    this.session = null;
  }
}
