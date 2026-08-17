import { DeckOption, RevealResult, VoteDistributionEntry } from 'shared-contracts';

function toNumeric(value: string, numericValues?: Record<string, number>): number {
  return numericValues?.[value] ?? Number(value);
}

// La escala para ajustar el promedio: explícita (mazos con siglas, ej. T-Shirt) o implícita
// (los propios valores del mazo parseados como número, ej. Fibonacci). Todo mazo tiene una.
function deckScale(deck?: DeckOption): number[] {
  if (deck?.numericValues) return Object.values(deck.numericValues);
  return (deck?.values ?? []).map(Number).filter(Number.isFinite);
}

export function computeRevealResult(
  votes: Record<string, string>,
  deck?: DeckOption
): RevealResult {
  const numericValues = deck?.numericValues;
  const values = Object.values(votes);

  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const distribution: VoteDistributionEntry[] = Array.from(counts.entries()).map(
    ([value, count]) => ({ value, count })
  );

  const parsedValues = values
    .map((value) => toNumeric(value, numericValues))
    .filter((value) => !Number.isNaN(value));

  let average =
    parsedValues.length > 0
      ? Math.round((parsedValues.reduce((sum, v) => sum + v, 0) / parsedValues.length) * 10) / 10
      : null;

  const scale = deckScale(deck);
  if (average !== null && scale.length > 0) {
    const rawAverage = average;
    average = scale.reduce((closest, candidate) =>
      Math.abs(candidate - rawAverage) < Math.abs(closest - rawAverage) ? candidate : closest
    );
  }

  let mode: string[] = [];
  if (counts.size > 0) {
    const maxCount = Math.max(...counts.values());
    mode = Array.from(counts.entries())
      .filter(([, count]) => count === maxCount)
      .map(([value]) => value);
  }

  return { votes, distribution, average, mode };
}
