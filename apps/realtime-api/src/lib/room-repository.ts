import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, roomKey } from './dynamo-client';
import { Participant, ResolvedStory, Room, RoundPhase } from 'shared-contracts';

interface RoomMetaItem {
  PK: string;
  SK: 'META';
  roomId: string;
  deckId: string;
  moderatorName: string;
  moderatorIsVoter: boolean;
  roundPhase: RoundPhase;
  currentStoryTitle: string | null;
  resolvedStories: ResolvedStory[];
  revealResult: Room['revealResult'];
  ttl: number;
}

interface ParticipantItem {
  PK: string;
  SK: string;
  name: string;
  connectionId: string;
  isModerator: boolean;
  isVoter: boolean;
  connected: boolean;
  vote: string | null;
}

export async function getRoomMeta(roomId: string): Promise<RoomMetaItem | undefined> {
  const result = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: roomKey(roomId) })
  );
  return result.Item as RoomMetaItem | undefined;
}

export async function getRoomParticipants(roomId: string): Promise<ParticipantItem[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `ROOM#${roomId}`,
        ':prefix': 'PARTICIPANT#',
      },
    })
  );
  return (result.Items ?? []) as ParticipantItem[];
}

export function toParticipant(item: ParticipantItem): Participant {
  return {
    name: item.name,
    isModerator: item.isModerator,
    isVoter: item.isVoter,
    connected: item.connected,
    vote: item.vote,
  };
}

export async function buildRoomState(roomId: string): Promise<Room | undefined> {
  const meta = await getRoomMeta(roomId);
  if (!meta) return undefined;

  const participantItems = await getRoomParticipants(roomId);
  const participants = participantItems.map(toParticipant);
  const accumulatedScore = meta.resolvedStories.reduce(
    (sum, story) => sum + (story.finalScore ?? 0),
    0
  );

  return {
    roomId: meta.roomId,
    deckId: meta.deckId,
    moderatorName: meta.moderatorName,
    roundPhase: meta.roundPhase,
    currentStoryTitle: meta.currentStoryTitle,
    participants,
    storiesEstimatedCount: meta.resolvedStories.length,
    accumulatedScore,
    revealResult: meta.revealResult,
  };
}

export function maskRoomForViewer(room: Room, viewerName: string): Room {
  if (room.roundPhase === 'revealed') return room;

  return {
    ...room,
    participants: room.participants.map((participant) =>
      participant.name === viewerName
        ? participant
        : { ...participant, vote: participant.vote !== null ? 'hidden' : null }
    ),
  };
}
