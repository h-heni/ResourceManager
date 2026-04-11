import React from 'react';
import { View, Text, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';
import Card from './Card';

interface SummaryItem {
  label: string;
  value: string | number;
  color?: string;
  icon?: React.ReactNode;
}

interface SummaryCardsProps {
  items: SummaryItem[];
  style?: ViewStyle;
}

export default function SummaryCards({ items, style }: SummaryCardsProps) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.container, style]} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
      {items.map((item, idx) => (
        <Card key={idx} style={[styles.card, idx < items.length - 1 && { marginRight: spacing.sm }]} padding="md">
          {item.icon && <View style={styles.icon}>{item.icon}</View>}
          <Text style={[styles.value, { color: item.color || colors.primary, fontSize: typography.fontSize.h2 }]}>{item.value}</Text>
          <Text style={[styles.label, { color: colors.text.tertiary, fontSize: typography.fontSize.small }]}>{item.label}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  card: { minWidth: 130 },
  icon: { marginBottom: 4 },
  value: { fontWeight: '700', marginBottom: 2 },
  label: {},
});
