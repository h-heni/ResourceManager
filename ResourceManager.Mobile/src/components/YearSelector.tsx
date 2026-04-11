import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

interface YearSelectorProps {
  value: number;
  onChange: (year: number) => void;
  minYear?: number;
  maxYear?: number;
}

export default function YearSelector({ value, onChange, minYear = 2020, maxYear }: YearSelectorProps) {
  const { colors, borderRadius } = useAppTheme();
  const max = maxYear || new Date().getFullYear();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }]}>
      <TouchableOpacity onPress={() => value > minYear && onChange(value - 1)} disabled={value <= minYear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={20} color={value <= minYear ? colors.text.light : colors.primary} />
      </TouchableOpacity>
      <Text style={[styles.year, { color: colors.text.primary }]}>{value}</Text>
      <TouchableOpacity onPress={() => value < max && onChange(value + 1)} disabled={value >= max} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-forward" size={20} color={value >= max ? colors.text.light : colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, alignSelf: 'center' },
  year: { fontSize: 16, fontWeight: '700', marginHorizontal: 16 },
});
