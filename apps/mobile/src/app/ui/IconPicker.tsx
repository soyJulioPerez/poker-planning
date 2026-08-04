import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconGroup } from 'shared-contracts';

interface IconPickerProps {
  iconGroup: IconGroup;
  selectedIcon: string | null;
  onSelect: (icon: string) => void;
}

export function IconPicker({ iconGroup, selectedIcon, onSelect }: IconPickerProps) {
  return (
    <View style={styles.grid}>
      {iconGroup.icons.map((icon) => (
        <TouchableOpacity
          key={icon}
          style={[styles.item, icon === selectedIcon && styles.itemSelected]}
          onPress={() => onSelect(icon)}
        >
          <Text style={styles.icon}>{icon}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  item: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  itemSelected: {
    borderColor: '#143055',
    backgroundColor: '#e5e9f0',
  },
  icon: {
    fontSize: 20,
  },
});
