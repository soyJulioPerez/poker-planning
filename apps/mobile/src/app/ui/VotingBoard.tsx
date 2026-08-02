import { StyleSheet, View } from 'react-native';
import { Card } from './Card';

interface VotingBoardProps {
  deckValues: string[];
  displayValues?: string[] | null;
  myVote: string | null;
  disabled?: boolean;
  onVote: (value: string) => void;
}

export function VotingBoard({ deckValues, displayValues, myVote, disabled, onVote }: VotingBoardProps) {
  return (
    <View style={styles.board}>
      {deckValues.map((value, index) => (
        <Card
          key={value}
          value={value}
          displayValue={displayValues?.[index] ?? null}
          selected={myVote === value}
          disabled={disabled}
          onPick={onVote}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
