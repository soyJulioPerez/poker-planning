export type RoundPhase = 'idle' | 'voting' | 'revealed';

export interface DeckOption {
  id: string;
  label: string;
  values: string[];
}

export interface IconGroup {
  id: string;
  label: string;
  icons: string[];
}

export interface Participant {
  name: string;
  isModerator: boolean;
  isVoter: boolean;
  connected: boolean;
  vote: string | null;
  icon: string | null;
}

export interface ResolvedStory {
  title: string;
  finalScore: number | null;
}

export interface VoteDistributionEntry {
  value: string;
  count: number;
}

export interface RevealResult {
  votes: Record<string, string>;
  distribution: VoteDistributionEntry[];
  average: number | null;
  mode: string[];
}

export interface RoomSummary {
  stories: ResolvedStory[];
  totalScore: number;
}

export interface Room {
  roomId: string;
  deckId: string;
  iconGroupId: string | null;
  moderatorName: string;
  roundPhase: RoundPhase;
  currentStoryTitle: string | null;
  participants: Participant[];
  storiesEstimatedCount: number;
  accumulatedScore: number;
  revealResult: RevealResult | null;
  lastResolvedStory: ResolvedStory | null;
}
