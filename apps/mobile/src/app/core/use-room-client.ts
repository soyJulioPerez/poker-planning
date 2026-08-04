import { useRoomClientContext } from './room-client-context';
import { useObservable } from './use-observable';

export function useRoomClient() {
  return useRoomClientContext().client;
}

export function useMyName(): [string | null, (name: string) => void] {
  const { myName, setMyName } = useRoomClientContext();
  return [myName, setMyName];
}

export function useRoom() {
  const client = useRoomClient();
  return useObservable(client.room$, null);
}

export function useRoomInfo() {
  const client = useRoomClient();
  return useObservable(client.roomInfo$, null);
}

export function useConnected() {
  const client = useRoomClient();
  return useObservable(client.connected$, false);
}

export function useJoinRejectedReason() {
  const client = useRoomClient();
  return useObservable(client.joinRejectedReason$, null);
}

export function useRoomSummary() {
  const client = useRoomClient();
  return useObservable(client.roomSummary$, null);
}

export function useErrorMessage() {
  const client = useRoomClient();
  return useObservable(client.errorMessage$, null);
}
