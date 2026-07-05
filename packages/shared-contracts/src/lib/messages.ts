import { Room, RoomSummary } from './domain';

export interface CreateRoomRequest {
  action: 'createRoom';
  moderatorName: string;
  deckId: string;
  moderatorIsVoter: boolean;
}

export interface JoinRoomRequest {
  action: 'joinRoom';
  roomId: string;
  name: string;
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
  | JoinRejectedMessage
  | RoomClosedMessage
  | ErrorMessage;
