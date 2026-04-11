import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api';
import Input from '../components/Input';
import { useAppTheme } from '../theme/ThemeContext';

export default function ResetPasswordScreen({ navigation, route }: any) {
  const { colors, borderRadius, typography } = useAppTheme();
  const { t } = useTranslation();

  const tokenFromRoute = route?.params?.token || '';
  const emailFromRoute = route?.params?.email || '';

  const [form, setForm] = useState({
    email: emailFromRoute,
    token: tokenFromRoute,
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.email.trim()) e.email = t('auth.emailRequired');
    if (!form.token.trim()) e.token = t('auth.tokenRequired');
    if (!form.newPassword) e.newPassword = t('auth.passwordRequired');
    else if (form.newPassword.length < 8) e.newPassword = t('auth.passwordMin');
    if (form.newPassword !== form.confirmPassword) e.confirmPassword = t('auth.passwordMismatch');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleReset = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await authApi.resetPassword(form);
      setSuccess(true);
    } catch (error) {
      setErrors({ general: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <LinearGradient colors={[colors.background, colors.surface, colors.background]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle-outline" size={32} color={colors.success} />
            </View>
            <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h2 }]}>{t('auth.passwordResetSuccess')}</Text>
            <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{t('auth.passwordResetSuccessMessage')}</Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.buttonText}>{t('auth.backToLogin')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[colors.background, colors.surface, colors.background]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>

            <View style={styles.logoSection}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="shield-checkmark-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h2 }]}>{t('auth.resetPasswordTitle')}</Text>
              <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>{t('auth.resetPasswordSubtitle')}</Text>
            </View>

            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
              {errors.general ? (
                <View style={[styles.errorBanner, { backgroundColor: colors.danger + '15', borderColor: colors.danger }]}>
                  <Text style={{ color: colors.danger }}>{errors.general}</Text>
                </View>
              ) : null}

              <Input
                label={t('auth.email')}
                placeholder={t('auth.emailPlaceholder')}
                value={form.email}
                onChangeText={(v) => updateField('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
                leftIcon={<Ionicons name="mail-outline" size={20} color={colors.text.light} />}
              />

              <Input
                label={t('auth.resetToken')}
                placeholder={t('auth.resetTokenPlaceholder')}
                value={form.token}
                onChangeText={(v) => updateField('token', v)}
                error={errors.token}
                leftIcon={<Ionicons name="key-outline" size={20} color={colors.text.light} />}
              />

              <Input
                label={t('auth.newPassword')}
                placeholder={t('auth.newPasswordPlaceholder')}
                value={form.newPassword}
                onChangeText={(v) => updateField('newPassword', v)}
                secureTextEntry={!showPassword}
                error={errors.newPassword}
                leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.text.light} />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.text.light} />
                  </TouchableOpacity>
                }
              />

              <Input
                label={t('auth.confirmPassword')}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                value={form.confirmPassword}
                onChangeText={(v) => updateField('confirmPassword', v)}
                secureTextEntry={!showPassword}
                error={errors.confirmPassword}
                leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.text.light} />}
              />

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
                onPress={handleReset}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>{t('auth.resetPassword')}</Text>}
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
  backBtn: { position: 'absolute', top: 0, left: 0, padding: 8 },
  logoSection: { alignItems: 'center', marginBottom: 24 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: 8, fontSize: 14 },
  formCard: { borderWidth: 1, padding: 24 },
  errorBanner: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  button: { marginTop: 20, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
