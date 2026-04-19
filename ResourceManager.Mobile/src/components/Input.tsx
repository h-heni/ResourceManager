import React from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'search';
}

export default function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  variant = 'default',
  style,
  ...props
}: InputProps) {
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && (
        <Text style={{ fontSize: typography.fontSize.small, color: colors.text.secondary, marginBottom: spacing.xs, fontWeight: typography.fontWeight.medium }}>{label}</Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          {
            borderColor: error
              ? colors.input.borderError
              : isFocused
              ? colors.input.borderFocus
              : colors.input.border,
            backgroundColor: variant === 'search' ? colors.offWhite : colors.input.background,
            borderRadius: borderRadius.xs,
          },
        ]}
      >
        {leftIcon && <View style={[styles.iconLeft, { left: spacing.sm }]}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            {
              color: colors.text.primary,
              fontSize: typography.fontSize.body,
              paddingLeft: leftIcon ? 40 : spacing.sm,
              paddingRight: rightIcon ? 40 : spacing.sm,
            },
          ]}
          placeholderTextColor={colors.input.placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {rightIcon && <View style={[styles.iconRight, { right: spacing.sm }]}>{rightIcon}</View>}
      </View>
      {error && <Text style={{ fontSize: typography.fontSize.small, color: colors.error, marginTop: spacing.xs }}>{error}</Text>}
      {helperText && !error && (
        <Text style={{ fontSize: typography.fontSize.small, color: colors.text.tertiary, marginTop: spacing.xs }}>{helperText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 44,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
  },
  iconLeft: {
    position: 'absolute',
    zIndex: 1,
  },
  iconRight: {
    position: 'absolute',
    zIndex: 1,
  },
});
