import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  accentColor?: string;
}

export default function StatCard({ icon, label, value, delta, deltaPositive, accentColor }: StatCardProps) {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const tint = accentColor || colors.primary;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: borderRadius.lg, borderColor: colors.border }, shadows.card]}>
      <View style={[styles.iconWrap, { backgroundColor: tint + '18', borderRadius: borderRadius.md }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <Text style={[styles.label, { color: colors.text.tertiary, fontSize: typography.fontSize.small }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text.primary, fontSize: typography.fontSize.h2 }]}>{value}</Text>
      {delta ? (
        <View style={styles.deltaRow}>
          <Ionicons
            name={deltaPositive ? 'arrow-up' : 'arrow-down'}
            size={12}
            color={deltaPositive ? colors.success : colors.error}
          />
          <Text style={[styles.delta, { color: deltaPositive ? colors.success : colors.error, fontSize: typography.fontSize.xs }]}>
            {delta}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, flex: 1, minWidth: 140 },
  iconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  label: { marginBottom: 4, fontWeight: '500' },
  value: { fontWeight: '700' },
  deltaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 3 },
  delta: { fontWeight: '600' },
});
