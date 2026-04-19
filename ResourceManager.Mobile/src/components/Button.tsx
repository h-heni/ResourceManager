import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

interface ButtonProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export default function Button({
  title,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  onPress,
  style,
  fullWidth = false,
  icon,
  iconPosition = 'left',
}: ButtonProps) {
  const { colors, spacing, borderRadius, typography } = useAppTheme();

  const getVariantStyle = (): { bg: string; text: string; border?: string } => {
    switch (variant) {
      case 'primary':
        return { bg: colors.button.primary, text: colors.white };
      case 'secondary':
        return { bg: colors.button.secondary, text: colors.text.secondary, border: colors.button.secondaryBorder };
      case 'danger':
        return { bg: colors.button.danger, text: colors.white };
      case 'ghost':
        return { bg: 'transparent', text: colors.primary };
      default:
        return { bg: colors.button.primary, text: colors.white };
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, minHeight: 36 };
      case 'large':
        return { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, minHeight: 52 };
      default:
        return { paddingVertical: 10, paddingHorizontal: spacing.lg, minHeight: 44 };
    }
  };

  const { bg, text, border } = getVariantStyle();
  const sizeStyle = getSizeStyle();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderColor: border,
          borderRadius: borderRadius.sm,
          minWidth: fullWidth ? '100%' : 120,
          ...sizeStyle,
        },
        disabled && { backgroundColor: colors.button.disabled, borderColor: 'transparent', opacity: 0.5 },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={text} />
      ) : (
        <View style={[styles.content, { gap: spacing.xs }]}>
          {icon && iconPosition === 'left' && (
            <View style={{ marginRight: spacing.xs }}>{icon}</View>
          )}
          <Text
            style={{
              color: disabled ? colors.text.light : text,
              fontSize: size === 'small' ? typography.fontSize.small : typography.fontSize.body,
              fontWeight: typography.fontWeight.medium,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <View style={{ marginLeft: spacing.xs }}>{icon}</View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
