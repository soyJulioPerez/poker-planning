import { getRoomMeta } from '../lib/room-repository';
import { sendToConnection } from '../lib/broadcast';
import { GetRoomInfoRequest } from 'shared-contracts';

export async function handleGetRoomInfo(
  apiEndpoint: string,
  connectionId: string,
  request: GetRoomInfoRequest
): Promise<void> {
  const meta = await getRoomMeta(request.roomId);
  if (!meta) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'joinRejected',
      reason: 'room-not-found',
    });
    return;
  }

  await sendToConnection(apiEndpoint, connectionId, {
    type: 'roomInfo',
    roomId: meta.roomId,
    deckId: meta.deckId,
    iconGroupId: meta.iconGroupId ?? null,
  });
}
