export interface StoredSession {
  roomId: string;
  name: string;
}

export interface SessionStore {
  get(roomId: string): StoredSession | null;
  save(roomId: string, name: string): void;
  clear(): void;
}
