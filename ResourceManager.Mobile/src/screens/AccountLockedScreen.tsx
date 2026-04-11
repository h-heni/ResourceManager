import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../theme/ThemeContext';

export default function AccountLockedScreen() {
  const { colors, borderRadius, typography } = useAppTheme();
  const { t } = useTranslation();
  const { logout, lockReason } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Force clear
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: colors.danger + '20' }]}>
          <Ionicons name="lock-closed" size={48} color={colors.danger} />
        </View>

        <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>
          {t('accountLocked.title')}
        </Text>

        <Text style={[styles.message, { color: colors.text.secondary, fontSize: typography.fontSize.body }]}>
          {lockReason === 'expired'
            ? t('accountLocked.expired')
            : lockReason === 'suspended'
            ? t('accountLocked.suspended')
            : t('accountLocked.genericMessage')}
        </Text>

        <Text style={[styles.contact, { color: colors.text.tertiary, fontSize: typography.fontSize.small }]}>
          {t('accountLocked.contactSupport')}
        </Text>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.danger, borderRadius: borderRadius.md }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#FFF" />
          <Text style={styles.logoutText}>{t('settings.logout')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  message: { textAlign: 'center', marginBottom: 8, lineHeight: 22 },
  contact: { textAlign: 'center', marginBottom: 32 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 32, minHeight: 48 },
  logoutText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
