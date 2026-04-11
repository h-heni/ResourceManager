import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { theme } from '../theme';

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
  if (!overlay) {
    return (
      <View style={styles.inline}>
        <ActivityIndicator
          size={size}
          color={theme.colors.primary}
        />
        {text && (
          <Text style={styles.text}>{text}</Text>
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
        <View style={styles.container}>
          <View style={styles.content}>
            <ActivityIndicator
              size={size}
              color={theme.colors.primary}
            />
            {text && (
              <Text style={styles.text}>{text}</Text>
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
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: theme.spacing.xl,
  },
  content: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.md,
    ...theme.shadows.modal,
  },
  text: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
});
