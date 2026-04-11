import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

interface CurrencyToggleProps {
  currencies: string[];
  selected: string;
  onSelect: (currency: string) => void;
}

export default function CurrencyToggle({ currencies, selected, onSelect }: CurrencyToggleProps) {
  const { colors, borderRadius } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }]}>
      {currencies.map((c) => (
        <TouchableOpacity
          key={c}
          style={[styles.option, c === selected && { backgroundColor: colors.primary }]}
          onPress={() => onSelect(c)}
          activeOpacity={0.7}
        >
          <Text style={[styles.text, { color: c === selected ? '#FFF' : colors.text.secondary }]}>{c}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderWidth: 1, overflow: 'hidden', alignSelf: 'center' },
  option: { paddingHorizontal: 14, paddingVertical: 6 },
  text: { fontSize: 13, fontWeight: '600' },
});
