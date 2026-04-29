import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import Input from '../components/Input';
import { useAppTheme } from '../theme/ThemeContext';

export default function LoginScreen({ navigation }: any) {
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { login, loginWithBiometrics, enableBiometrics, biometrics, biometricEnabled } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Automatically trigger biometric prompt on mount if user has it enabled
  useEffect(() => {
    if (biometricEnabled && biometrics.available && biometrics.enrolled) {
      handleBiometricLogin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricEnabled]);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) {
      newErrors.email = t('auth.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('auth.emailInvalid');
    }
    if (!password) {
      newErrors.password = t('auth.passwordRequired');
    } else if (password.length < 8) {
      newErrors.password = t('auth.passwordTooShort');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      await login({ email, password });
      // After first successful login, offer biometric if available and not yet enabled
      if (biometrics.available && biometrics.enrolled && !biometricEnabled) {
        Alert.alert(
          t('auth.biometricEnableTitle'),
          t('auth.biometricEnableMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('auth.biometricEnable'),
              onPress: async () => {
                try { await enableBiometrics(); } catch { /* ignore */ }
              },
            },
          ],
        );
      }
    } catch (error) {
      const msg = (error as Error).message || 'Login failed. Please try again.';
      setErrors({ ...errors, password: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      await loginWithBiometrics(t('auth.biometricPrompt'));
    } catch (err) {
      const code = (err as Error).message;
      if (code === 'session_expired') {
        // Session is gone — show a friendly hint and let the user enter password
        setErrors({ password: t('auth.sessionExpiredBiometric') });
      }
      // 'biometric_cancelled' and hardware errors: silently ignore (user just sees the form)
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <LinearGradient colors={[colors.background, colors.surface, colors.background]} style={{ flex: 1 }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]} showsVerticalScrollIndicator={false}>
            {/* Logo */}
            <View style={styles.logoSection}>
              <Image source={require('../../assets/logo.jpeg')} style={[styles.logoContainer, { borderRadius: borderRadius.lg }]} resizeMode="contain" />
              <Text style={[styles.welcomeText, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('auth.welcomeBack')}</Text>
              <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.body, textAlign: 'center' }}>{t('auth.signInSubtitle')}</Text>
            </View>

            {/* Form Card */}
            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
              <Input
                label={t('auth.email')}
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChangeText={(text) => { setEmail(text); if (errors.email) setErrors({ ...errors, email: undefined }); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.email}
                leftIcon={<Ionicons name="mail-outline" size={20} color={colors.text.light} />}
              />

              <Input
                label={t('auth.password')}
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChangeText={(text) => { setPassword(text); if (errors.password) setErrors({ ...errors, password: undefined }); }}
                secureTextEntry={!showPassword}
                error={errors.password}
                leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.text.light} />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.text.light} />
                  </TouchableOpacity>
                }
              />

              <TouchableOpacity
                style={[styles.signInButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.signInText}>{t('auth.signIn')}</Text>
                )}
              </TouchableOpacity>

              {/* Biometric login button — shown when the user has opted in */}
              {biometricEnabled && biometrics.available && biometrics.enrolled && (
                <TouchableOpacity
                  style={[styles.biometricButton, { borderColor: colors.primary, borderRadius: borderRadius.md }]}
                  onPress={handleBiometricLogin}
                  disabled={biometricLoading}
                  activeOpacity={0.8}
                >
                  {biometricLoading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons
                        name={biometrics.type === 'facial' ? 'scan-outline' : 'finger-print-outline'}
                        size={22}
                        color={colors.primary}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={[styles.biometricText, { color: colors.primary }]}>
                        {t(biometrics.type === 'facial' ? 'auth.biometricLoginFace' : 'auth.biometricLoginFingerprint')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={{ color: colors.text.secondary, fontSize: typography.fontSize.body }}>
                {t('auth.forgotPassword')}{' '}
                <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('auth.resetHere')}</Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoContainer: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoText: { fontSize: 32, fontWeight: '800', color: '#FFF' },
  welcomeText: { fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  formCard: { borderWidth: 1, padding: 24 },
  signInButton: { marginTop: 20, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  signInText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  biometricButton: { marginTop: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 48, borderWidth: 1.5 },
  biometricText: { fontSize: 15, fontWeight: '600' },
  footer: { marginTop: 28, alignItems: 'center' },
});
