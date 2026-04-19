import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

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
  const { colors, spacing, borderRadius, typography, dark } = useAppTheme();

  const getStatusStyle = (): { bg: string; textColor: string } => {
    // In dark mode use a lower-opacity tint so backgrounds don't wash out
    const alpha = dark ? '22' : '';
    switch (status) {
      case 'success':
        return { bg: dark ? colors.success + '22' : colors.successBg, textColor: colors.success };
      case 'warning':
        return { bg: dark ? colors.warning + '22' : colors.warningBg, textColor: colors.warning };
      case 'error':
        return { bg: dark ? colors.error + '22' : colors.errorBg, textColor: colors.error };
      case 'info':
        return { bg: dark ? colors.info + '22' : colors.infoBg, textColor: colors.info };
      default:
        return { bg: colors.divider, textColor: colors.text.tertiary };
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return { paddingHorizontal: spacing.sm, paddingVertical: 4, minHeight: 24 };
      case 'large':
        return { paddingHorizontal: spacing.lg, paddingVertical: 8, minHeight: 40 };
      default:
        return { paddingHorizontal: spacing.md, paddingVertical: 6, minHeight: 32 };
    }
  };

  const { bg, textColor } = getStatusStyle();
  const sizeStyle = getSizeStyle();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderRadius: borderRadius.full, gap: spacing.xs, ...sizeStyle },
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
                ? typography.fontSize.small
                : size === 'large'
                ? typography.fontSize.body
                : typography.fontSize.caption,
            fontWeight: typography.fontWeight.semiBold as any,
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
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {},
  icon: {
    // fontSize removed — was invalid on View
  },
});
