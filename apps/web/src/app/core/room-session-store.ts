import { SessionStore, StoredSession } from 'room-client-runtime';

const SESSION_KEY = 'poker-planning-session';

export class BrowserSessionStore implements SessionStore {
  get(roomId: string): StoredSession | null {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const session: StoredSession = JSON.parse(raw);
    if (session.roomId !== roomId) return null;

    return session;
  }

  save(roomId: string, name: string, participantId: string): void {
    const session: StoredSession = { roomId, name, participantId };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  clear(): void {
    sessionStorage.removeItem(SESSION_KEY);
  }
}
