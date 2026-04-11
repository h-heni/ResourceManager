import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../theme';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'default';

interface StatusBadgeProps {
  status: StatusType;
  text: string;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export default function StatusBadge({
  status,
  text,
  size = 'small',
  style,
  icon,
}: StatusBadgeProps) {
  const getStatusStyle = (): { bg: string; textColor: string } => {
    switch (status) {
      case 'success':
        return {
          bg: theme.colors.successBg,
          textColor: theme.colors.success,
        };
      case 'warning':
        return {
          bg: theme.colors.warningBg,
          textColor: theme.colors.warning,
        };
      case 'error':
        return {
          bg: theme.colors.errorBg,
          textColor: theme.colors.error,
        };
      case 'info':
        return {
          bg: theme.colors.infoBg,
          textColor: theme.colors.info,
        };
      default:
        return {
          bg: theme.colors.divider,
          textColor: theme.colors.text.tertiary,
        };
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: 4,
          minHeight: 24,
        };
      case 'large':
        return {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: 8,
          minHeight: 40,
        };
      default:
        return {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: 6,
          minHeight: 32,
        };
    }
  };

  const { bg, textColor } = getStatusStyle();
  const sizeStyle = getSizeStyle();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          ...sizeStyle,
        },
        style,
      ]}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize:
              size === 'small'
                ? theme.typography.fontSize.small
                : size === 'large'
                ? theme.typography.fontSize.body
                : theme.typography.fontSize.caption,
          },
        ]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: theme.borderRadius.full,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  text: {
    fontWeight: theme.typography.fontWeight.semiBold,
  },
  icon: {
    fontSize: 12,
  },
});
