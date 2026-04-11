import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChangeText, placeholder }: SearchBarProps) {
  const { colors, borderRadius, typography } = useAppTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.input.background, borderColor: colors.input.border, borderRadius: borderRadius.md }]}>
      <Ionicons name="search-outline" size={18} color={colors.text.light} style={styles.icon} />
      <TextInput
        style={[styles.input, { color: colors.text.primary, fontSize: typography.fontSize.body }]}
        placeholder={placeholder || 'Search...'}
        placeholderTextColor={colors.input.placeholder}
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Ionicons name="close-circle" size={18} color={colors.text.light} onPress={() => onChangeText('')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 12, height: 44 },
  icon: { marginRight: 8 },
  input: { flex: 1, height: '100%', padding: 0 },
});
