import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function ChartCard({ title, subtitle, children }: ChartCardProps) {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: borderRadius.lg, borderColor: colors.border }, shadows.card]}>
      <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h3 }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.text.tertiary, fontSize: typography.fontSize.small }]}>{subtitle}</Text> : null}
      <View style={styles.chartWrap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, marginBottom: 16 },
  title: { fontWeight: '600', marginBottom: 2 },
  subtitle: { marginBottom: 12 },
  chartWrap: { marginTop: 8 },
});
