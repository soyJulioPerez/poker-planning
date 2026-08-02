import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RevealResult } from 'shared-contracts';

interface RevealPanelProps {
  result: RevealResult;
  isModerator: boolean;
  numericValues: Record<string, number> | null;
  onResolveVote: (score: number) => void;
  onNewRound: () => void;
}

function voteAsNumber(vote: string, numericValues: Record<string, number> | null): number | null {
  const value = numericValues?.[vote] ?? Number(vote);
  return Number.isFinite(value) ? value : null;
}

export function RevealPanel({ result, isModerator, numericValues, onResolveVote, onNewRound }: RevealPanelProps) {
  return (
    <View>
      <Text style={styles.title}>Votos revelados</Text>
      {isModerator ? <Text style={styles.hint}>Tocá un voto para usarlo como puntuación final</Text> : null}

      {isModerator ? (
        <TouchableOpacity style={styles.newRoundButton} onPress={onNewRound}>
          <Text style={styles.newRoundButtonText}>↻ Nueva ronda</Text>
        </TouchableOpacity>
      ) : null}

      {Object.entries(result.votes).map(([name, vote]) => {
        const numeric = isModerator ? voteAsNumber(vote, numericValues) : null;
        return (
          <TouchableOpacity
            key={name}
            style={styles.voteRow}
            disabled={numeric === null}
            onPress={() => numeric !== null && onResolveVote(numeric)}
          >
            <Text style={styles.voteName}>{name}</Text>
            <Text style={styles.voteValue}>{vote}</Text>
          </TouchableOpacity>
        );
      })}

      {result.mode.length > 1 ? <Text style={styles.stats}>Moda: {result.mode.join(', ')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  hint: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  newRoundButton: { alignSelf: 'flex-start', marginBottom: 8 },
  newRoundButtonText: { fontSize: 14, color: '#143055' },
  voteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  voteName: { fontSize: 14 },
  voteValue: { fontSize: 14, fontWeight: '600' },
  stats: { marginTop: 8, fontSize: 13, color: '#6b7280' },
});
