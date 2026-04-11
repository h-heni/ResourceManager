import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import Modal from './Modal';
import Button from './Button';
import FormDatePicker from './FormDatePicker';

interface PaymentRecordModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { amount: number; paymentDate: string; notes?: string; isScheduled?: boolean }) => void;
  loading?: boolean;
  maxAmount?: number;
  currency?: string;
}

export default function PaymentRecordModal({
  visible,
  onClose,
  onSubmit,
  loading = false,
  maxAmount,
  currency = 'TND',
}: PaymentRecordModalProps) {
  const { colors, borderRadius, typography } = useAppTheme();
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ amount?: string }>({});

  const handleSubmit = () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      setErrors({ amount: t('form.amountRequired') });
      return;
    }
    if (maxAmount && parsed > maxAmount) {
      setErrors({ amount: t('form.amountExceedsRemaining') });
      return;
    }
    onSubmit({
      amount: parsed,
      paymentDate: date.toISOString(),
      notes: notes || undefined,
    });
    setAmount('');
    setNotes('');
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t('form.recordPayment')}
      footer={
        <View style={styles.footer}>
          <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1, marginRight: 8 }} />
          <Button title={t('common.save')} onPress={handleSubmit} loading={loading} style={{ flex: 1 }} />
        </View>
      }
    >
      <ScrollView>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>{t('form.amount')} ({currency})</Text>
          <TextInput
            style={[styles.input, { color: colors.text.primary, borderColor: errors.amount ? colors.error : colors.input.border, backgroundColor: colors.input.background, borderRadius: borderRadius.xs }]}
            value={amount}
            onChangeText={(v) => { setAmount(v); setErrors({}); }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.input.placeholder}
          />
          {errors.amount && <Text style={[styles.error, { color: colors.error }]}>{errors.amount}</Text>}
          {maxAmount != null && (
            <Text style={[styles.helper, { color: colors.text.tertiary }]}>{t('form.remaining')}: {maxAmount.toFixed(2)} {currency}</Text>
          )}
        </View>

        <FormDatePicker label={t('form.paymentDate')} value={date} onChange={setDate} />

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>{t('form.notes')}</Text>
          <TextInput
            style={[styles.input, styles.multiline, { color: colors.text.primary, borderColor: colors.input.border, backgroundColor: colors.input.background, borderRadius: borderRadius.xs }]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('form.notesPlaceholder')}
            placeholderTextColor={colors.input.placeholder}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row' },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  input: { borderWidth: 1, minHeight: 44, paddingHorizontal: 12, fontSize: 14 },
  multiline: { minHeight: 80, paddingTop: 10, textAlignVertical: 'top' },
  error: { fontSize: 12, marginTop: 4 },
  helper: { fontSize: 12, marginTop: 4 },
});
