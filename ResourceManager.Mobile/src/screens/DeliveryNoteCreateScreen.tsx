import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import Input from '../components/Input';
import { FormSelect, FormDatePicker, ItemsEditor } from '../components';
import type { SelectOption, LineItem } from '../components';
import { useClients } from '../hooks/useDirectory';
import { useCreateDeliveryNote, useUpdateDeliveryNote } from '../hooks/useSales';

export default function DeliveryNoteCreateScreen({ navigation, route }: any) {
  const { colors, borderRadius, typography } = useAppTheme();
  const { t } = useTranslation();
  const editData = route?.params?.deliveryNote;
  const isEdit = !!editData;

  const { data: clients } = useClients();
  const createMutation = useCreateDeliveryNote();
  const updateMutation = useUpdateDeliveryNote();

  const [clientId, setClientId] = useState<string>(editData?.clientId?.toString() || '');
  const [noteNumber, setNoteNumber] = useState(editData?.number || '');
  const [date, setDate] = useState(editData?.date ? new Date(editData.date) : new Date());
  const [notes, setNotes] = useState(editData?.notes || '');
  const [items, setItems] = useState<LineItem[]>(
    editData?.items?.map((it: any) => ({
      description: it.description || '',
      quantity: it.quantity || 1,
      price: it.unitPrice || it.price || 0,
      tva: it.vat !== undefined ? !!it.vat : true,
      vatRate: it.vatRate || 19,
    })) || [{ description: '', quantity: 1, price: 0, tva: true, vatRate: 19 }]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clientOptions: SelectOption[] = (clients?.items ?? []).map((c: any) => ({
    label: c.name,
    value: c.id?.toString(),
  }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!clientId) e.clientId = t('createPage.clientRequired');
    if (!noteNumber.trim()) e.noteNumber = t('createPage.numberRequired');
    const validItems = items.filter(i => i.description.trim());
    if (validItems.length === 0) e.items = t('createPage.itemsRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload = {
      clientId: parseInt(clientId),
      number: noteNumber,
      date: date.toISOString(),
      notes,
      items: items.filter(i => i.description.trim()).map(i => ({
        description: i.description,
        quantity: i.quantity,
        price: i.price,
        taxRate: i.tva ? (i.vatRate ?? 0) / 100 : 0,
      })),
    };

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: editData.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('common.error'), (error as Error).message);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary, fontSize: typography.fontSize.h3 }]}>
          {isEdit ? t('deliveryNote.edit') : t('deliveryNote.create')}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={isPending} style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.sm }]}>
          {isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="checkmark" size={22} color="#FFF" />}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
          <FormSelect
            label={t('deliveryNote.client')}
            options={clientOptions}
            selectedValue={clientId}
            onValueChange={setClientId}
            placeholder={t('createPage.selectClient')}
            error={errors.clientId}
          />

          <Input
            label={t('deliveryNote.number')}
            placeholder={t('createPage.numberPlaceholder')}
            value={noteNumber}
            onChangeText={(v) => { setNoteNumber(v); if (errors.noteNumber) setErrors(p => ({ ...p, noteNumber: '' })); }}
            error={errors.noteNumber}
            leftIcon={<Ionicons name="document-text-outline" size={20} color={colors.text.light} />}
          />

          <FormDatePicker label={t('deliveryNote.date')} value={date} onChange={setDate} />

          <ItemsEditor items={items} onChange={setItems} error={errors.items} />

          <Input
            label={t('createPage.notes')}
            placeholder={t('createPage.notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          {/* Totals */}
          <View style={[styles.totalsCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }]}>
            <View style={styles.totalRow}>
              <Text style={{ color: colors.text.secondary }}>{t('createPage.subtotal')}</Text>
              <Text style={{ color: colors.text.primary, fontWeight: '600' }}>
                {items.reduce((s, i) => s + i.quantity * i.price, 0).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.totalFinal]}>
              <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: typography.fontSize.h3 }}>{t('deliveryNote.total')}</Text>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: typography.fontSize.h3 }}>
                {items.reduce((s, i) => {
                  const base = i.quantity * i.price;
                  return s + base + (i.tva ? base * ((i.vatRate ?? 0) / 100) : 0);
                }, 0).toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { marginRight: 12 },
  headerTitle: { flex: 1, fontWeight: '700' },
  saveBtn: { padding: 8 },
  form: { padding: 16 },
  totalsCard: { borderWidth: 1, padding: 16, marginTop: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalFinal: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12, marginTop: 4 },
});
