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

// Las cartas que rodean al promedio: la de abajo y la de arriba, o una sola si coincide.
// Como el promedio cae entre el voto mínimo y el máximo, normalmente hay vecina de cada
// lado; si faltara alguna (escala vacía, dato inesperado) se devuelve solo la que exista.
function boundsInScale(value: number, scale: number[]): number[] {
  const sorted = [...new Set(scale)].sort((a, b) => a - b);
  if (sorted.includes(value)) return [value];
  const lower = sorted.filter((v) => v < value).at(-1);
  const upper = sorted.find((v) => v > value);
  return [lower, upper].filter((v): v is number => v !== undefined);
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

  const exactAverage =
    parsedValues.length > 0
      ? parsedValues.reduce((sum, v) => sum + v, 0) / parsedValues.length
      : null;

  // Lo que muestra la web: el promedio de verdad, y las cartas entre las que cae.
  const rawAverage = exactAverage === null ? null : Math.round(exactAverage * 100) / 100;
  const scale = deckScale(deck);
  const averageBounds = rawAverage === null ? [] : boundsInScale(rawAverage, scale);

  // `average` conserva su cálculo de siempre (1 decimal, ajustado a la carta más cercana):
  // lo sigue usando la app mobile, incluidas las versiones ya instaladas.
  let average = exactAverage === null ? null : Math.round(exactAverage * 10) / 10;
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

  return { votes, distribution, average, rawAverage, averageBounds, mode };
}
