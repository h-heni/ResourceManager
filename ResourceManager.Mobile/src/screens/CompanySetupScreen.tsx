import React, { useEffect, useState } from 'react';
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
import { useSetupCompany, useSettings } from '../hooks/useSettings';

export default function CompanySetupScreen({ navigation }: any) {
  const { colors, borderRadius, typography } = useAppTheme();
  const { t } = useTranslation();
  const setupMutation = useSetupCompany();
  const { data: existingCompany } = useSettings();

  const [form, setForm] = useState({
    name: '',
    industry: '',
    phone: '',
    email: '',
    address: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (existingCompany) {
      setForm({
        name: existingCompany.companyName || '',
        industry: (existingCompany as any).industry || '',
        phone: (existingCompany as any).phone || '',
        email: (existingCompany as any).email || '',
        address: (existingCompany as any).address || '',
      });
    }
  }, [existingCompany]);

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t('companySetup.nameRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;
    try {
      await setupMutation.mutateAsync({
        companyName: form.name,
        industry: form.industry,
        phone: form.phone,
        email: form.email,
        address: form.address,
      });
      navigation.navigate('CompanyInit');
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
                <Text style={styles.stepText}>1/2</Text>
              </View>
              <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h2 }]}>{t('companySetup.title')}</Text>
              <Text style={{ color: colors.text.tertiary, textAlign: 'center', fontSize: typography.fontSize.body }}>{t('companySetup.subtitle')}</Text>
            </View>

            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>  
              {errors.general ? (
                <View style={[styles.errorBanner, { backgroundColor: colors.danger + '15', borderColor: colors.danger }]}>
                  <Text style={{ color: colors.danger }}>{errors.general}</Text>
                </View>
              ) : null}

              <Input
                label={t('companySetup.companyName')}
                placeholder={t('companySetup.companyNamePlaceholder')}
                value={form.name}
                onChangeText={(v) => updateField('name', v)}
                error={errors.name}
                leftIcon={<Ionicons name="business-outline" size={20} color={colors.text.light} />}
              />

              <Input
                label={t('companySetup.industry')}
                placeholder={t('companySetup.industryPlaceholder')}
                value={form.industry}
                onChangeText={(v) => updateField('industry', v)}
                leftIcon={<Ionicons name="briefcase-outline" size={20} color={colors.text.light} />}
              />

              <Input
                label={t('companySetup.phone')}
                placeholder={t('companySetup.phonePlaceholder')}
                value={form.phone}
                onChangeText={(v) => updateField('phone', v)}
                keyboardType="phone-pad"
                leftIcon={<Ionicons name="call-outline" size={20} color={colors.text.light} />}
              />

              <Input
                label={t('companySetup.email')}
                placeholder={t('companySetup.emailPlaceholder')}
                value={form.email}
                onChangeText={(v) => updateField('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Ionicons name="mail-outline" size={20} color={colors.text.light} />}
              />

              <Input
                label={t('companySetup.address')}
                placeholder={t('companySetup.addressPlaceholder')}
                value={form.address}
                onChangeText={(v) => updateField('address', v)}
                leftIcon={<Ionicons name="location-outline" size={20} color={colors.text.light} />}
              />

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
                onPress={handleNext}
                disabled={setupMutation.isPending}
              >
                {setupMutation.isPending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <View style={styles.buttonInner}>
                    <Text style={styles.buttonText}>{t('common.next')}</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
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
  button: { marginTop: 20, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
