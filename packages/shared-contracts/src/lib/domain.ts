export type RoundPhase = 'idle' | 'voting' | 'revealed';

export interface DeckOption {
  id: string;
  label: string;
  values: string[];
  displayValues?: string[];
  numericValues?: Record<string, number>;
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
  /** Epoch ms de la última desconexión; `null` si está conectado o es un registro previo a este campo. */
  disconnectedAt: number | null;
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
  /**
   * Promedio ajustado al valor de la escala más cercano. La web ya no lo muestra (usa
   * `rawAverage` y `averageBounds`), pero se conserva porque lo usa la app mobile.
   */
  average: number | null;
  /** Promedio real de los votos numéricos, redondeado a 2 decimales. */
  rawAverage: number | null;
  /**
   * Valores de la escala que rodean a `rawAverage`: `[inferior, superior]`, o `[valor]` si
   * coincide con uno. Vacío si no hubo votos numéricos o el mazo no tiene escala.
   */
  averageBounds: number[];
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
