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

export default function ForgotPasswordScreen({ navigation }: any) {
  const { colors, borderRadius, typography } = useAppTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) { setError(t('auth.emailRequired')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t('auth.emailInvalid')); return; }
    setLoading(true);
    setError('');
    try {
      await authApi.forgotPassword({ email });
      setSubmitted(true);
    } catch {
      setSubmitted(true); // Always show success to prevent enumeration
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <LinearGradient colors={[colors.background, colors.surface, colors.background]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="mail-outline" size={32} color={colors.success} />
            </View>
            <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h2 }]}>{t('auth.checkEmail')}</Text>
            <Text style={[styles.subtitle, { color: colors.text.secondary, fontSize: typography.fontSize.body }]}>{t('auth.resetEmailSent')}</Text>
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
            {/* Back */}
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>

            <View style={styles.logoSection}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="key-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h2 }]}>{t('auth.forgotPasswordTitle')}</Text>
              <Text style={[styles.subtitle, { color: colors.text.tertiary, fontSize: typography.fontSize.body }]}>{t('auth.forgotPasswordSubtitle')}</Text>
            </View>

            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
              {error ? (
                <View style={[styles.errorBanner, { backgroundColor: colors.danger + '15', borderColor: colors.danger }]}>
                  <Text style={{ color: colors.danger }}>{error}</Text>
                </View>
              ) : null}

              <Input
                label={t('auth.email')}
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChangeText={(v) => { setEmail(v); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Ionicons name="mail-outline" size={20} color={colors.text.light} />}
              />

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>{t('auth.sendResetLink')}</Text>}
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
  subtitle: { textAlign: 'center', marginBottom: 8 },
  formCard: { borderWidth: 1, padding: 24 },
  errorBanner: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  button: { marginTop: 20, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
