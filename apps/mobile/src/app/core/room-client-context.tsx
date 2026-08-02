import { createContext, ReactNode, useContext, useMemo, useState, useEffect } from 'react';
import { RoomClient } from 'room-client-runtime';
import { InMemorySessionStore } from './session-store';

const websocketUrl: string = (() => {
  const url = process.env.EXPO_PUBLIC_WS_URL;
  if (!url) throw new Error('EXPO_PUBLIC_WS_URL no está configurada (ver apps/mobile/.env)');
  return url;
})();

interface RoomClientContextValue {
  client: RoomClient;
  myName: string | null;
  setMyName: (name: string) => void;
}

const RoomClientContext = createContext<RoomClientContextValue | null>(null);

export function RoomClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => new RoomClient({ websocketUrl }, new InMemorySessionStore()), []);
  // Optimista: la pantalla Home lo asigna antes de que el servidor confirme la sala
  // (ver createRoom/joinRoom), igual que myName en apps/web/.../room-socket.service.ts.
  const [myName, setMyNameState] = useState<string | null>(null);

  useEffect(() => {
    const subscription = client.myName$.subscribe((name) => {
      if (name !== null) setMyNameState(name);
    });
    return () => subscription.unsubscribe();
  }, [client]);

  const value = useMemo<RoomClientContextValue>(
    () => ({ client, myName, setMyName: setMyNameState }),
    [client, myName],
  );

  return <RoomClientContext.Provider value={value}>{children}</RoomClientContext.Provider>;
}

export function useRoomClientContext(): RoomClientContextValue {
  const value = useContext(RoomClientContext);
  if (!value) throw new Error('useRoomClientContext debe usarse dentro de RoomClientProvider');
  return value;
}
