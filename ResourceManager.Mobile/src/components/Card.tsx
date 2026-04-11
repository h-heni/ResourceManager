import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'transparent';
  padding?: keyof typeof theme.spacing;
  noShadow?: boolean;
}

export default function Card({
  children,
  style,
  variant = 'default',
  padding = 'lg',
  noShadow = false,
}: CardProps) {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          ...theme.shadows.elevated,
          backgroundColor: theme.colors.card.elevated,
        };
      case 'transparent':
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
        };
      default:
        return {
          ...!noShadow && theme.shadows.card,
          backgroundColor: theme.colors.card.default,
        };
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          padding: theme.spacing[padding],
          borderRadius: theme.borderRadius.md,
          borderWidth: variant !== 'transparent' ? 1 : 0,
          borderColor: variant !== 'transparent' ? theme.colors.border : 'transparent',
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
  card: {
    backgroundColor: theme.colors.white,
  },
});
