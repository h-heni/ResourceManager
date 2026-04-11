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
import { theme } from '../theme';

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
  const getVariantStyle = (): { bg: string; text: string; border?: string } => {
    switch (variant) {
      case 'primary':
        return {
          bg: theme.colors.button.primary,
          text: theme.colors.white,
        };
      case 'secondary':
        return {
          bg: theme.colors.button.secondary,
          text: theme.colors.text.secondary,
          border: theme.colors.button.secondaryBorder,
        };
      case 'danger':
        return {
          bg: theme.colors.button.danger,
          text: theme.colors.white,
        };
      case 'ghost':
        return {
          bg: 'transparent',
          text: theme.colors.primary,
        };
      default:
        return {
          bg: theme.colors.button.primary,
          text: theme.colors.white,
        };
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          minHeight: 36,
        };
      case 'large':
        return {
          paddingVertical: theme.spacing.lg,
          paddingHorizontal: theme.spacing.xl,
          minHeight: 52,
        };
      default:
        return {
          paddingVertical: 10,
          paddingHorizontal: theme.spacing.lg,
          minHeight: 44,
        };
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
          minWidth: fullWidth ? '100%' : 120,
          ...sizeStyle,
        },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={text} />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <View style={styles.iconLeft}>{icon}</View>
          )}
          <Text
            style={[
              styles.buttonText,
              {
                color: disabled ? theme.colors.text.light : text,
                fontSize: size === 'small' ? theme.typography.fontSize.small : theme.typography.fontSize.body,
              },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <View style={styles.iconRight}>{icon}</View>
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
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  buttonText: {
    fontWeight: theme.typography.fontWeight.medium,
    textAlign: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  iconLeft: {
    marginRight: theme.spacing.xs,
  },
  iconRight: {
    marginLeft: theme.spacing.xs,
  },
  disabled: {
    backgroundColor: theme.colors.button.disabled,
    borderColor: 'transparent',
    opacity: 0.5,
  },
});
