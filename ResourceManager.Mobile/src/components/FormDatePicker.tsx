import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

interface FormDatePickerProps {
  label?: string;
  value?: Date;
  onChange: (date: Date) => void;
  placeholder?: string;
  error?: string;
  mode?: 'date' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
}

export default function FormDatePicker({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  error,
  mode = 'date',
  minimumDate,
  maximumDate,
}: FormDatePickerProps) {
  const { colors, borderRadius, typography } = useAppTheme();
  const [show, setShow] = useState(false);

  const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selectedDate) onChange(selectedDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

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
        onPress={() => setShow(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.text.tertiary} style={{ marginRight: 8 }} />
        <Text style={{ color: value ? colors.text.primary : colors.input.placeholder, flex: 1, fontSize: typography.fontSize.body }}>
          {value ? formatDate(value) : placeholder}
        </Text>
      </TouchableOpacity>
      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
      {show && (
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: { fontWeight: '500', marginBottom: 4 },
  trigger: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, minHeight: 44, paddingHorizontal: 12 },
  error: { fontSize: 12, marginTop: 4 },
});
