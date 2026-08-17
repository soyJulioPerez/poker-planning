export interface StoredSession {
  roomId: string;
  name: string;
  participantId: string;
}

export interface SessionStore {
  get(roomId: string): StoredSession | null;
  save(roomId: string, name: string, participantId: string): void;
  clear(): void;
}
