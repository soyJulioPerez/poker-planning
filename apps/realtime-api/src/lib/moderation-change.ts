import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, roomKey, participantKey } from './dynamo-client';

export interface ModerationChange {
  roomId: string;
  previousModerator: string;
  nextModerator: string;
  /**
   * Solo para la toma: el moderador anterior tiene que seguir desconectado desde antes de
   * este instante (epoch ms). Un registro sin `disconnectedAt` cuenta como desconectado hace
   * tiempo (participante previo al campo).
   */
  previousDisconnectedBefore?: number;
}

/**
 * Pasa la moderación de un participante a otro en una sola transacción.
 *
 * El rol vive en tres lugares (`META.moderatorName` y el `isModerator` de cada participante)
 * y escribirlos por separado puede dejar dos moderadores o ninguno. La condición sobre
 * `META.moderatorName` es además la que resuelve dos tomas simultáneas: la segunda ya no
 * encuentra al moderador que esperaba y se cancela.
 *
 * Devuelve `false` si alguna condición no se cumplió (nada se escribió).
 */
export async function commitModerationChange(change: ModerationChange): Promise<boolean> {
  const { roomId, previousModerator, nextModerator, previousDisconnectedBefore } = change;

  const previousCondition =
    previousDisconnectedBefore === undefined
      ? 'attribute_exists(PK)'
      : 'attribute_exists(PK) AND connected = :false AND ' +
        '(attribute_not_exists(disconnectedAt) OR disconnectedAt <= :disconnectedBefore)';

  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLE_NAME,
              Key: roomKey(roomId),
              UpdateExpression: 'SET moderatorName = :next, moderatorIsVoter = :true',
              ConditionExpression: 'moderatorName = :previous',
              ExpressionAttributeValues: {
                ':next': nextModerator,
                ':previous': previousModerator,
                ':true': true,
              },
            },
          },
          {
            Update: {
              TableName: TABLE_NAME,
              Key: participantKey(roomId, nextModerator),
              UpdateExpression: 'SET isModerator = :true, isVoter = :true',
              ConditionExpression: 'attribute_exists(PK) AND connected = :true',
              ExpressionAttributeValues: { ':true': true },
            },
          },
          {
            // Ambos quedan votando: el nuevo moderador puede apagarlo después con el control
            // de siempre, y el anterior pasa a ser un participante común, que siempre vota.
            Update: {
              TableName: TABLE_NAME,
              Key: participantKey(roomId, previousModerator),
              UpdateExpression: 'SET isModerator = :false, isVoter = :true',
              ConditionExpression: previousCondition,
              ExpressionAttributeValues: {
                ':false': false,
                ':true': true,
                ...(previousDisconnectedBefore !== undefined && {
                  ':disconnectedBefore': previousDisconnectedBefore,
                }),
              },
            },
          },
        ],
      })
    );
    return true;
  } catch (error) {
    if ((error as { name?: string }).name === 'TransactionCanceledException') return false;
    throw error;
  }
}
