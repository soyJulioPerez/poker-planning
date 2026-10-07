import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, connectionKey } from '../lib/dynamo-client';
import { getRoomMeta, getRoomParticipants, buildRoomState, maskRoomForViewer } from '../lib/room-repository';
import { broadcastRoomState, sendToConnection } from '../lib/broadcast';
import { commitModerationChange } from '../lib/moderation-change';
import { ClaimModerationRequest, MODERATION_CLAIM_DELAY_MS } from 'shared-contracts';

export async function handleClaimModeration(
  apiEndpoint: string,
  connectionId: string,
  request: ClaimModerationRequest
): Promise<void> {
  const connection = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: connectionKey(connectionId) })
  );
  const name = connection.Item?.['name'] as string | undefined;

  const meta = await getRoomMeta(request.roomId);
  if (!meta) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Room not found',
    });
    return;
  }

  if (name === meta.moderatorName) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'You are already the moderator',
    });
    return;
  }

  const participants = await getRoomParticipants(request.roomId);
  const claimant = participants.find((p) => p.name === name);
  if (!name || !claimant?.connected) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Only connected participants can claim moderation',
    });
    return;
  }

  // Estas dos comprobaciones dan un error claro en el caso común; la transacción las repite
  // de forma atómica, porque entre esta lectura y la escritura el moderador puede volver.
  const moderator = participants.find((p) => p.name === meta.moderatorName);
  const disconnectedBefore = Date.now() - MODERATION_CLAIM_DELAY_MS;
  if (moderator?.connected) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'The moderator is still connected',
    });
    return;
  }
  if (moderator?.disconnectedAt !== undefined && moderator.disconnectedAt > disconnectedBefore) {
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'The moderator has not been disconnected long enough',
    });
    return;
  }

  const committed = await commitModerationChange({
    roomId: request.roomId,
    previousModerator: meta.moderatorName,
    nextModerator: name,
    previousDisconnectedBefore: disconnectedBefore,
  });
  if (!committed) {
    // Lo más probable: otro participante la tomó primero, o el moderador volvió justo.
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Moderation could not be claimed',
    });
    return;
  }

  const room = await buildRoomState(request.roomId);
  if (room) {
    await broadcastRoomState(apiEndpoint, room, maskRoomForViewer);
  }
}
