import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { apiEndpointFromEvent, sendToConnection } from '../lib/broadcast';
import { logger } from '../lib/logger';
import { tracer } from '../lib/tracer';
import { handleCreateRoom } from '../actions/create-room';
import { handleJoinRoom } from '../actions/join-room';
import { handleGetRoomInfo } from '../actions/get-room-info';
import { handleVote } from '../actions/vote';
import { handleReveal } from '../actions/reveal';
import { handleResolveStory } from '../actions/resolve-story';
import { handleNewRound } from '../actions/new-round';
import { handleNextStory } from '../actions/next-story';
import { handleSetModeratorIsVoter } from '../actions/set-moderator-is-voter';
import { handleCloseRoom } from '../actions/close-room';
import { ClientRequest } from 'shared-contracts';

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  // Separado del try/catch de JSON.parse de abajo: ese puede responderle al cliente
  // porque ya conoce connectionId. Este no — si esto falla, todavia no hay a quien
  // avisarle nada, asi que solo queda loguear con lo que se tenga y relanzar.
  let connectionId: string;
  let apiEndpoint: string;
  try {
    connectionId = event.requestContext.connectionId;
    apiEndpoint = apiEndpointFromEvent(event);
  } catch (error) {
    logger.error('action.malformed_event', { error });
    throw error;
  }

  let request: ClientRequest;
  try {
    request = JSON.parse(event.body ?? '{}');
  } catch {
    logger.warn('action.invalid_payload', { connectionId });
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: 'Invalid message payload',
    });
    return { statusCode: 200, body: 'OK' };
  }

  // `createRoom` es la unica accion sin `roomId` en el request: la sala todavia no
  // existe cuando llega el mensaje. Se completa mas abajo con lo que devuelve
  // handleCreateRoom, para que el log de salida de esa accion tambien lo incluya.
  let roomId = 'roomId' in request ? request.roomId : undefined;
  const started = Date.now();
  logger.info('action.received', { connectionId, action: request.action, roomId });

  // Powertools no deja anotar el segmento "facade" que Lambda crea para toda la invocacion
  // (lo rechaza en silencio); hace falta un subsegmento propio. Patron de instrumentacion
  // manual documentado por Powertools para handlers sin decorator ni Middy.
  const facadeSegment = tracer.getSegment();
  const actionSegment = facadeSegment?.addNewSubsegment(`## ${request.action}`);
  if (actionSegment) {
    tracer.setSegment(actionSegment);
  }
  tracer.putAnnotation('action', request.action);

  try {
    switch (request.action) {
      case 'createRoom':
        roomId = await handleCreateRoom(apiEndpoint, connectionId, request);
        break;
      case 'joinRoom':
        await handleJoinRoom(apiEndpoint, connectionId, request);
        break;
      case 'getRoomInfo':
        await handleGetRoomInfo(apiEndpoint, connectionId, request);
        break;
      case 'vote':
        await handleVote(apiEndpoint, connectionId, request);
        break;
      case 'reveal':
        await handleReveal(apiEndpoint, connectionId, request);
        break;
      case 'resolveStory':
        await handleResolveStory(apiEndpoint, connectionId, request);
        break;
      case 'newRound':
        await handleNewRound(apiEndpoint, connectionId, request);
        break;
      case 'nextStory':
        await handleNextStory(apiEndpoint, connectionId, request);
        break;
      case 'setModeratorIsVoter':
        await handleSetModeratorIsVoter(apiEndpoint, connectionId, request);
        break;
      case 'closeRoom':
        await handleCloseRoom(apiEndpoint, connectionId, request);
        break;
      default:
        await sendToConnection(apiEndpoint, connectionId, {
          type: 'error',
          message: `Unsupported action: ${(request as { action?: string }).action}`,
        });
    }
    logger.info('action.done', {
      connectionId,
      action: request.action,
      roomId,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    // Se loguea ANTES de intentar avisarle al cliente: si sendToConnection tambien
    // fallara, la causa original no debe depender de que ese envio funcione.
    logger.error('action.failed', {
      connectionId,
      action: request.action,
      roomId,
      durationMs: Date.now() - started,
      error,
    });
    await sendToConnection(apiEndpoint, connectionId, {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    // `roomId` puede resolverse recien dentro del switch (caso `createRoom`), asi que la
    // annotation se agrega al cierre, cuando ya se conoce en ambos caminos (exito y error) —
    // y antes de cerrar el subsegmento, mientras todavia es el segmento activo.
    if (roomId) {
      tracer.putAnnotation('roomId', roomId);
    }
    if (actionSegment && facadeSegment) {
      actionSegment.close();
      tracer.setSegment(facadeSegment);
    }
  }

  return { statusCode: 200, body: 'OK' };
};
