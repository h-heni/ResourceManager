import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import Input from '../components/Input';
import { useUpdateBranding } from '../hooks/useSettings';

export default function CompanyInitScreen({ navigation }: any) {
  const { colors, borderRadius, typography } = useAppTheme();
  const { t } = useTranslation();
  const brandingMutation = useUpdateBranding();

  const [form, setForm] = useState({
    ice: '',
    iif: '',
    tp: '',
    cnss: '',
    rc: '',
    taxId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleFinish = async () => {
    try {
      await brandingMutation.mutateAsync({
        ice: form.ice,
        iif: form.iif,
        tp: form.tp,
        cnss: form.cnss,
        rc: form.rc,
        taxId: form.taxId,
      } as any);
      // Navigation will automatically redirect to MainTabs after profile is complete
    } catch (error) {
      setErrors({ general: (error as Error).message });
    }
  };

  return (
    <LinearGradient colors={[colors.background, colors.surface, colors.background]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View style={[styles.stepIndicator, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepText}>2/2</Text>
              </View>
              <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h2 }]}>{t('companyInit.title')}</Text>
              <Text style={{ color: colors.text.tertiary, textAlign: 'center', fontSize: typography.fontSize.body }}>{t('companyInit.subtitle')}</Text>
            </View>

            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
              {errors.general ? (
                <View style={[styles.errorBanner, { backgroundColor: colors.danger + '15', borderColor: colors.danger }]}>
                  <Text style={{ color: colors.danger }}>{errors.general}</Text>
                </View>
              ) : null}

              <Input
                label={t('companyInit.ice')}
                placeholder={t('companyInit.icePlaceholder')}
                value={form.ice}
                onChangeText={(v) => updateField('ice', v)}
                leftIcon={<Ionicons name="document-text-outline" size={20} color={colors.text.light} />}
              />

              <Input
                label={t('companyInit.iif')}
                placeholder={t('companyInit.iifPlaceholder')}
                value={form.iif}
                onChangeText={(v) => updateField('iif', v)}
                leftIcon={<Ionicons name="document-text-outline" size={20} color={colors.text.light} />}
              />

              <Input
                label={t('companyInit.tp')}
                placeholder={t('companyInit.tpPlaceholder')}
                value={form.tp}
                onChangeText={(v) => updateField('tp', v)}
                leftIcon={<Ionicons name="document-text-outline" size={20} color={colors.text.light} />}
              />

              <Input
                label={t('companyInit.cnss')}
                placeholder={t('companyInit.cnssPlaceholder')}
                value={form.cnss}
                onChangeText={(v) => updateField('cnss', v)}
                leftIcon={<Ionicons name="document-text-outline" size={20} color={colors.text.light} />}
              />

              <Input
                label={t('companyInit.rc')}
                placeholder={t('companyInit.rcPlaceholder')}
                value={form.rc}
                onChangeText={(v) => updateField('rc', v)}
                leftIcon={<Ionicons name="document-text-outline" size={20} color={colors.text.light} />}
              />

              <Input
                label={t('companyInit.taxId')}
                placeholder={t('companyInit.taxIdPlaceholder')}
                value={form.taxId}
                onChangeText={(v) => updateField('taxId', v)}
                leftIcon={<Ionicons name="document-text-outline" size={20} color={colors.text.light} />}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.skipButton, { borderColor: colors.border, borderRadius: borderRadius.md }]}
                  onPress={handleFinish}
                >
                  <Text style={{ color: colors.text.secondary, fontWeight: '600' }}>{t('common.skip')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.finishButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
                  onPress={handleFinish}
                  disabled={brandingMutation.isPending}
                >
                  {brandingMutation.isPending ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <View style={styles.buttonInner}>
                      <Text style={styles.buttonText}>{t('companyInit.finish')}</Text>
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 24 },
  stepIndicator: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  stepText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  title: { fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  formCard: { borderWidth: 1, padding: 24 },
  errorBanner: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  buttonRow: { flexDirection: 'row', marginTop: 20, gap: 12 },
  skipButton: { flex: 1, borderWidth: 1, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  finishButton: { flex: 2, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
