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
import { theme } from '../theme';

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
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          {
            borderColor: error
              ? theme.colors.input.borderError
              : isFocused
              ? theme.colors.input.borderFocus
              : theme.colors.input.border,
            backgroundColor: variant === 'search' ? theme.colors.offWhite : theme.colors.input.background,
          },
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            {
              color: theme.colors.text.primary,
              paddingLeft: leftIcon ? 40 : theme.spacing.sm,
              paddingRight: rightIcon ? 40 : theme.spacing.sm,
            },
          ]}
          placeholderTextColor={theme.colors.input.placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {helperText && !error && (
        <Text style={styles.helperText}>{helperText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSize.small,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
    fontWeight: theme.typography.fontWeight.medium,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.borderRadius.xs,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.fontSize.body,
    paddingVertical: 0,
  },
  iconLeft: {
    position: 'absolute',
    left: theme.spacing.sm,
    zIndex: 1,
  },
  iconRight: {
    position: 'absolute',
    right: theme.spacing.sm,
    zIndex: 1,
  },
  errorText: {
    fontSize: theme.typography.fontSize.small,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  helperText: {
    fontSize: theme.typography.fontSize.small,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xs,
  },
});
