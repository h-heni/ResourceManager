import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import FormSelect, { SelectOption } from './FormSelect';

export interface LineItem {
  key: string;
  description: string;
  quantity: number;
  price: number;
  taxRate: number;
}

interface ItemsEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  productOptions?: SelectOption[];
}

let counter = 0;
const nextKey = () => `item_${Date.now()}_${++counter}`;

export default function ItemsEditor({ items, onChange, productOptions }: ItemsEditorProps) {
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  const { t } = useTranslation();

  const addItem = () => {
    onChange([...items, { key: nextKey(), description: '', quantity: 1, price: 0, taxRate: 0 }]);
  };

  const removeItem = (key: string) => {
    onChange(items.filter((i) => i.key !== key));
  };

  const updateItem = (key: string, field: keyof LineItem, value: any) => {
    onChange(items.map((i) => (i.key === key ? { ...i, [field]: value } : i)));
  };

  const lineTotal = (item: LineItem) => item.quantity * item.price;

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('form.lineItems')}</Text>
        <TouchableOpacity onPress={addItem} style={[styles.addBtn, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="add-circle" size={18} color={colors.primary} />
          <Text style={[styles.addText, { color: colors.primary }]}>{t('form.addItem')}</Text>
        </TouchableOpacity>
      </View>

      {items.map((item, idx) => (
        <View key={item.key} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }]}>
          <View style={styles.itemHeader}>
            <Text style={{ color: colors.text.secondary, fontWeight: '600', fontSize: 13 }}>#{idx + 1}</Text>
            <TouchableOpacity onPress={() => removeItem(item.key)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>

          {productOptions && productOptions.length > 0 ? (
            <FormSelect
              label={t('form.product')}
              placeholder={t('form.selectProduct')}
              options={productOptions}
              value={item.description}
              onSelect={(v) => {
                const opt = productOptions.find((o) => o.value === v);
                if (opt) updateItem(item.key, 'description', opt.label);
              }}
            />
          ) : (
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('form.description')}</Text>
              <TextInput
                style={[styles.textInput, { color: colors.text.primary, borderColor: colors.input.border, backgroundColor: colors.input.background, borderRadius: borderRadius.xs }]}
                value={item.description}
                onChangeText={(v) => updateItem(item.key, 'description', v)}
                placeholder={t('form.descriptionPlaceholder')}
                placeholderTextColor={colors.input.placeholder}
              />
            </View>
          )}

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('form.quantity')}</Text>
              <TextInput
                style={[styles.textInput, { color: colors.text.primary, borderColor: colors.input.border, backgroundColor: colors.input.background, borderRadius: borderRadius.xs }]}
                value={String(item.quantity)}
                onChangeText={(v) => updateItem(item.key, 'quantity', parseFloat(v) || 0)}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('form.unitPrice')}</Text>
              <TextInput
                style={[styles.textInput, { color: colors.text.primary, borderColor: colors.input.border, backgroundColor: colors.input.background, borderRadius: borderRadius.xs }]}
                value={String(item.price)}
                onChangeText={(v) => updateItem(item.key, 'price', parseFloat(v) || 0)}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('form.vat')} %</Text>
              <TextInput
                style={[styles.textInput, { color: colors.text.primary, borderColor: colors.input.border, backgroundColor: colors.input.background, borderRadius: borderRadius.xs }]}
                value={String(item.taxRate)}
                onChangeText={(v) => updateItem(item.key, 'taxRate', parseFloat(v) || 0)}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={[styles.lineTotal, { color: colors.primary }]}>
            {t('form.total')}: {lineTotal(item).toFixed(2)}
          </Text>
        </View>
      ))}

      {items.length === 0 && (
        <Text style={[styles.empty, { color: colors.text.tertiary }]}>{t('form.noItems')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  itemCard: { borderWidth: 1, padding: 12, marginBottom: 10 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fieldGroup: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  textInput: { borderWidth: 1, minHeight: 40, paddingHorizontal: 10, fontSize: 14 },
  row: { flexDirection: 'row', marginBottom: 8 },
  lineTotal: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  empty: { textAlign: 'center', paddingVertical: 20, fontSize: 14 },
});
