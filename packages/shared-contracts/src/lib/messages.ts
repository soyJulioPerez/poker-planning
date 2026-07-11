import { Room, RoomSummary } from './domain';

export interface CreateRoomRequest {
  action: 'createRoom';
  moderatorName: string;
  deckId: string;
  moderatorIsVoter: boolean;
  iconGroupId?: string;
  icon?: string;
}

export interface JoinRoomRequest {
  action: 'joinRoom';
  roomId: string;
  name: string;
  icon?: string;
}

export interface GetRoomInfoRequest {
  action: 'getRoomInfo';
  roomId: string;
}

export interface VoteRequest {
  action: 'vote';
  roomId: string;
  value: string;
}

export interface RevealRequest {
  action: 'reveal';
  roomId: string;
}

export interface ResolveStoryRequest {
  action: 'resolveStory';
  roomId: string;
  finalScore: number;
}

export interface NewRoundRequest {
  action: 'newRound';
  roomId: string;
}

export interface NextStoryRequest {
  action: 'nextStory';
  roomId: string;
  storyTitle: string;
}

export interface SetModeratorIsVoterRequest {
  action: 'setModeratorIsVoter';
  roomId: string;
  isVoter: boolean;
}

export interface CloseRoomRequest {
  action: 'closeRoom';
  roomId: string;
}

export type ClientRequest =
  | CreateRoomRequest
  | JoinRoomRequest
  | GetRoomInfoRequest
  | VoteRequest
  | RevealRequest
  | ResolveStoryRequest
  | NewRoundRequest
  | NextStoryRequest
  | SetModeratorIsVoterRequest
  | CloseRoomRequest;

export interface RoomStateMessage {
  type: 'roomState';
  room: Room;
}

export interface RoomInfoMessage {
  type: 'roomInfo';
  roomId: string;
  deckId: string;
  iconGroupId: string | null;
}

export interface JoinRejectedMessage {
  type: 'joinRejected';
  reason: 'name-taken' | 'room-not-found';
}

export interface RoomClosedMessage {
  type: 'roomClosed';
  summary: RoomSummary;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage =
  | RoomStateMessage
  | RoomInfoMessage
  | JoinRejectedMessage
  | RoomClosedMessage
  | ErrorMessage;
