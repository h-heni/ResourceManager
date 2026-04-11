import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import Input from '../components/Input';
import { useAppTheme } from '../theme/ThemeContext';

export default function SignUpScreen({ navigation }: any) {
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  const { t } = useTranslation();
  const { signUp } = useAuth();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = t('auth.firstNameRequired');
    if (!form.lastName.trim()) e.lastName = t('auth.lastNameRequired');
    if (!form.email.trim()) e.email = t('auth.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('auth.emailInvalid');
    if (!form.password) e.password = t('auth.passwordRequired');
    else if (form.password.length < 8) e.password = t('auth.passwordMin');
    if (form.password !== form.confirmPassword) e.confirmPassword = t('auth.passwordMismatch');
    if (!form.companyName.trim()) e.companyName = t('auth.companyNameRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await signUp({
        companyName: form.companyName,
        userEmail: form.email,
        userPassword: form.password,
        userFirstName: form.firstName,
        userLastName: form.lastName,
      });
    } catch (error) {
      const msg = (error as Error).message || t('auth.signUpFailed');
      setErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[colors.background, colors.surface, colors.background]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Logo */}
            <View style={styles.logoSection}>
              <LinearGradient colors={[colors.primary, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.logoContainer, { borderRadius: borderRadius.lg }]}>
                <Text style={styles.logoText}>RM</Text>
              </LinearGradient>
              <Text style={[styles.welcomeText, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('auth.createAccount')}</Text>
              <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.body, textAlign: 'center' }}>{t('auth.signUpSubtitle')}</Text>
            </View>

            {/* Form */}
            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>  
              {errors.general ? (
                <View style={[styles.errorBanner, { backgroundColor: colors.danger + '15', borderColor: colors.danger }]}>
                  <Text style={{ color: colors.danger, fontSize: typography.fontSize.small }}>{errors.general}</Text>
                </View>
              ) : null}

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Input
                    label={t('auth.firstName')}
                    placeholder={t('auth.firstNamePlaceholder')}
                    value={form.firstName}
                    onChangeText={(v) => updateField('firstName', v)}
                    error={errors.firstName}
                    leftIcon={<Ionicons name="person-outline" size={20} color={colors.text.light} />}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Input
                    label={t('auth.lastName')}
                    placeholder={t('auth.lastNamePlaceholder')}
                    value={form.lastName}
                    onChangeText={(v) => updateField('lastName', v)}
                    error={errors.lastName}
                  />
                </View>
              </View>

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
                label={t('auth.companyName')}
                placeholder={t('auth.companyNamePlaceholder')}
                value={form.companyName}
                onChangeText={(v) => updateField('companyName', v)}
                error={errors.companyName}
                leftIcon={<Ionicons name="business-outline" size={20} color={colors.text.light} />}
              />

              <Input
                label={t('auth.password')}
                placeholder={t('auth.passwordPlaceholder')}
                value={form.password}
                onChangeText={(v) => updateField('password', v)}
                secureTextEntry={!showPassword}
                error={errors.password}
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
                style={[styles.signUpButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
                onPress={handleSignUp}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.signUpText}>{t('auth.signUp')}</Text>}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={{ color: colors.text.secondary, fontSize: typography.fontSize.body }}>
                {t('auth.alreadyHaveAccount')}{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: typography.fontSize.body }}>{t('auth.signIn')}</Text>
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
  logoSection: { alignItems: 'center', marginBottom: 24 },
  logoContainer: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText: { fontSize: 32, fontWeight: '800', color: '#FFF' },
  welcomeText: { fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  formCard: { borderWidth: 1, padding: 24 },
  errorBanner: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  row: { flexDirection: 'row' },
  signUpButton: { marginTop: 20, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  signUpText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  footer: { marginTop: 28, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
});
