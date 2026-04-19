import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

interface LoadingProps {
  visible?: boolean;
  text?: string;
  overlay?: boolean;
  size?: 'small' | 'large';
}

export default function Loading({
  visible = true,
  text,
  overlay = true,
  size = 'large',
}: LoadingProps) {
  const { colors, spacing, borderRadius, shadows } = useAppTheme();

  if (!overlay) {
    return (
      <View style={[styles.inline, { gap: spacing.sm, padding: spacing.lg }]}>
        <ActivityIndicator
          size={size}
          color={colors.primary}
        />
        {text && (
          <Text style={{ fontSize: 14, color: colors.text.secondary, marginTop: spacing.sm, textAlign: 'center' }}>{text}</Text>
        )}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => {}}
      >
        <View style={{ padding: spacing.xl }}>
          <View style={[styles.content, { backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.xl, gap: spacing.md }, shadows.elevated]}>
            <ActivityIndicator
              size={size}
              color={colors.primary}
            />
            {text && (
              <Text style={{ fontSize: 14, color: colors.text.secondary, marginTop: spacing.sm, textAlign: 'center' }}>{text}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
});
