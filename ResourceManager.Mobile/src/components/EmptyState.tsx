import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  icon,
  title = 'No Data',
  message = 'There are no items to display.',
  action,
}: EmptyStateProps) {
  const { colors, spacing, typography, shadows } = useAppTheme();

  return (
    <View style={[styles.container, { padding: spacing.xl }]}>
      <View style={{ marginBottom: spacing.xl }}>
        {icon || (
          <View style={[styles.defaultIcon, { backgroundColor: colors.offWhite }, shadows.card]}>
            <Text style={styles.defaultIconText}>📭</Text>
          </View>
        )}
      </View>

      <Text style={{ fontSize: typography.fontSize.h2, fontWeight: typography.fontWeight.semiBold, color: colors.text.primary, marginBottom: spacing.sm, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: typography.fontSize.body, color: colors.text.tertiary, textAlign: 'center', marginBottom: spacing.lg }}>{message}</Text>

      {action && <View style={{ marginTop: spacing.lg }}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  defaultIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultIconText: {
    fontSize: 40,
  },
});
