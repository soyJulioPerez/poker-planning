import { RevealResult, VoteDistributionEntry } from 'shared-contracts';

function toNumeric(value: string, numericValues?: Record<string, number>): number {
  return numericValues?.[value] ?? Number(value);
}

export function computeRevealResult(
  votes: Record<string, string>,
  numericValues?: Record<string, number>
): RevealResult {
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

  if (average !== null && numericValues) {
    const rawAverage = average;
    const scale = Object.values(numericValues);
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
