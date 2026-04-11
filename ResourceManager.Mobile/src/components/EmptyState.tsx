import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { theme } from '../theme';

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
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        {icon || (
          <View style={styles.defaultIcon}>
            <Text style={styles.defaultIconText}>📭</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {action && <View style={styles.actionContainer}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    minHeight: 300,
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  defaultIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.card,
  },
  defaultIconText: {
    fontSize: 40,
  },
  title: {
    fontSize: theme.typography.fontSize.h2,
    fontWeight: theme.typography.fontWeight.semiBold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  actionContainer: {
    marginTop: theme.spacing.lg,
  },
});
