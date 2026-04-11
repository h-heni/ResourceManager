import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import Modal from './Modal';
import Button from './Button';

interface ConfirmDeleteModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  title?: string;
  message?: string;
}

export default function ConfirmDeleteModal({
  visible,
  onClose,
  onConfirm,
  loading = false,
  title,
  message,
}: ConfirmDeleteModalProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={title || t('form.confirmDelete')}
      footer={
        <View style={styles.footer}>
          <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1, marginRight: 8 }} />
          <Button title={t('common.delete')} variant="danger" onPress={onConfirm} loading={loading} style={{ flex: 1 }} />
        </View>
      }
    >
      <Text style={[styles.message, { color: colors.text.secondary }]}>
        {message || t('form.deleteMessage')}
      </Text>
    </Modal>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row' },
  message: { fontSize: 15, lineHeight: 22 },
});
