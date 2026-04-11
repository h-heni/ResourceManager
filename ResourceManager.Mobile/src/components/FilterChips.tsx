import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

interface FilterChipsProps {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}

export default function FilterChips({ options, selected, onSelect }: FilterChipsProps) {
  const { colors, borderRadius, typography } = useAppTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((opt) => {
        const active = opt === selected;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.border,
                borderRadius: borderRadius.full,
              },
            ]}
          >
            <Text style={[styles.label, { color: active ? '#FFF' : colors.text.secondary, fontSize: typography.fontSize.small }]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1 },
  label: { fontWeight: '500' },
});
