import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Modal as RNModal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

export interface SelectOption {
  label: string;
  value: string | number;
}

interface FormSelectProps {
  label?: string;
  placeholder?: string;
  value?: string | number;
  options: SelectOption[];
  onSelect?: (value: string | number) => void;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  // Legacy aliases for backwards-compat
  selectedValue?: string | number;
  onValueChange?: (value: string) => void;
}

export default function FormSelect({
  label,
  placeholder = 'Select...',
  value,
  options,
  onSelect,
  error,
  disabled = false,
  searchable = false,
  selectedValue,
  onValueChange,
}: FormSelectProps) {
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const effectiveValue = value ?? selectedValue;
  const handleSelect = (v: string | number) => {
    onSelect?.(v);
    onValueChange?.(String(v));
  };

  const selectedOption = options.find((o) => o.value === effectiveValue);
  const filtered = searchable && search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.text.secondary, fontSize: typography.fontSize.small }]}>{label}</Text>}
      <TouchableOpacity
        style={[
          styles.trigger,
          {
            borderColor: error ? colors.error : colors.input.border,
            backgroundColor: colors.input.background,
            borderRadius: borderRadius.xs,
          },
        ]}
        onPress={() => !disabled && setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={{ color: selectedOption ? colors.text.primary : colors.input.placeholder, flex: 1, fontSize: typography.fontSize.body }}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.text.tertiary} />
      </TouchableOpacity>
      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

      <RNModal visible={visible} transparent animationType="slide" statusBarTranslucent>
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { backgroundColor: colors.card, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg }]}>
              {label && <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>{label}</Text>}
              <FlatList
                data={filtered}
                keyExtractor={(item) => String(item.value)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.option, { borderBottomColor: colors.border }]}
                    onPress={() => { handleSelect(item.value); setVisible(false); }}
                  >
                    <Text style={[styles.optionText, { color: item.value === effectiveValue ? colors.primary : colors.text.primary }]}>{item.label}</Text>
                    {item.value === effectiveValue && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 350 }}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: { fontWeight: '500', marginBottom: 4 },
  trigger: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, minHeight: 44, paddingHorizontal: 12 },
  error: { fontSize: 12, marginTop: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { paddingTop: 16, paddingBottom: 34, paddingHorizontal: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  optionText: { fontSize: 15 },
});
