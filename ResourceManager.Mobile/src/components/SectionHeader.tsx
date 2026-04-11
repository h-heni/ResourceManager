import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const { colors, typography } = useAppTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h3 }]}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={[styles.action, { color: colors.primary, fontSize: typography.fontSize.small }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontWeight: '600' },
  action: { fontWeight: '500' },
});
