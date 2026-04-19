import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  TouchableWithoutFeedback,
  TouchableOpacity,
} from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: any;
  maxWidth?: number;
}

export default function Modal({
  visible,
  onClose,
  title,
  children,
  footer,
  style,
  maxWidth = 400,
}: ModalProps) {
  const { colors, spacing, borderRadius, typography, shadows } = useAppTheme();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.overlay, { padding: spacing.lg }]}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.container,
                {
                  maxWidth,
                  backgroundColor: colors.card,
                  borderRadius: borderRadius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadows.modal,
                },
                style,
              ]}
            >
              {title && (
                <View
                  style={[
                    styles.header,
                    { padding: spacing.lg, borderBottomColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.title,
                      {
                        color: colors.text.primary,
                        fontSize: typography.fontSize.h2,
                        fontWeight: typography.fontWeight.semiBold,
                      },
                    ]}
                  >
                    {title}
                  </Text>
                  <TouchableOpacity
                    style={[styles.closeButton, { padding: spacing.xs, marginLeft: spacing.sm }]}
                    onPress={onClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[styles.closeIcon, { color: colors.text.tertiary }]}>x</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ flexShrink: 1, padding: spacing.lg, overflow: 'hidden' }}>{children}</View>

              {footer && (
                <View
                  style={[
                    styles.footer,
                    {
                      gap: spacing.sm,
                      padding: spacing.lg,
                      borderTopColor: colors.border,
                    },
                  ]}
                >
                  {footer}
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  title: {
    flex: 1,
  },
  closeButton: {},
  closeIcon: {
    fontSize: 32,
    lineHeight: 28,
    fontWeight: '300',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
  },
});