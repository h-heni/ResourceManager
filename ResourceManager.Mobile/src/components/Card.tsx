import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useAppTheme, type AppTheme } from '../theme/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'transparent';
  padding?: keyof AppTheme['spacing'];
  noShadow?: boolean;
}

export default function Card({
  children,
  style,
  variant = 'default',
  padding = 'lg',
  noShadow = false,
}: CardProps) {
  const { colors, spacing, borderRadius, shadows } = useAppTheme();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          ...shadows.elevated,
          backgroundColor: colors.cardElevated,
        };
      case 'transparent':
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
        };
      default:
        return {
          ...!noShadow && shadows.card,
          backgroundColor: colors.card,
        };
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          padding: spacing[padding],
          borderRadius: borderRadius.md,
          borderWidth: variant !== 'transparent' ? 1 : 0,
          borderColor: variant !== 'transparent' ? colors.border : 'transparent',
        },
        getVariantStyle(),
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
});
