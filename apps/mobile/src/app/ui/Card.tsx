import { StyleSheet, Text, TouchableOpacity } from 'react-native';

interface CardProps {
  value: string;
  displayValue?: string | null;
  selected?: boolean;
  disabled?: boolean;
  onPick: (value: string) => void;
}

function displayIconsFor(value: string, displayValue?: string | null): string | null {
  if (!displayValue || displayValue === value) return null;
  const spaceIndex = displayValue.lastIndexOf(' ');
  return spaceIndex === -1 ? displayValue : displayValue.slice(0, spaceIndex);
}

export function Card({ value, displayValue, selected, disabled, onPick }: CardProps) {
  const icons = displayIconsFor(value, displayValue);

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected, disabled && styles.cardDisabled]}
      disabled={disabled}
      onPress={() => onPick(value)}
    >
      {icons ? <Text style={[styles.icons, selected && styles.textSelected]}>{icons}</Text> : null}
      <Text style={[styles.value, selected && styles.textSelected]}>{value}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 56,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#143055',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  cardSelected: {
    backgroundColor: '#143055',
  },
  cardDisabled: {
    opacity: 0.4,
  },
  icons: {
    fontSize: 12,
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
  },
  textSelected: {
    color: '#ffffff',
  },
});
