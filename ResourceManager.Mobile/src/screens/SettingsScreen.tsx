import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme, useThemeMode } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useSettings, useChangePassword } from '../hooks/useSettings';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import { LANGUAGE_KEY } from '../i18n';

export default function SettingsScreen({ navigation }: any) {
  const { colors, spacing, borderRadius, shadows, typography, dark } = useAppTheme();
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { themeMode, setThemeMode } = useThemeMode();
  const { data: companySettings } = useSettings();
  const changePasswordMutation = useChangePassword();

  const [showPassword, setShowPassword] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const handleLogout = () => {
    Alert.alert(t('settings.logoutTitle'), t('settings.logoutMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logout'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleChangePassword = () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert(t('common.error'), t('settings.passwordMismatch'));
      return;
    }
    changePasswordMutation.mutate(
      { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword },
      {
        onSuccess: () => {
          setShowPassword(false);
          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
          Alert.alert(t('common.success'), t('settings.passwordChanged'));
        },
        onError: () => Alert.alert(t('common.error'), t('settings.passwordError')),
      }
    );
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    AsyncStorage.setItem(LANGUAGE_KEY, lang);
    setShowLanguage(false);
  };

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Fran\u00E7ais' },
    { code: 'de', label: 'Deutsch' },
    { code: 'ar', label: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629' },
  ];

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : 'RM';

  const SettingRow = ({ icon, title, subtitle, onPress, trailing }: any) => (
    <TouchableOpacity
      style={[styles.settingRow, { borderBottomColor: colors.divider }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.settingIcon, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text.primary, fontWeight: '500' }}>{title}</Text>
        {subtitle && <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      {trailing || <Ionicons name="chevron-forward" size={20} color={colors.text.light} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('settings.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User Profile */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg, margin: spacing.md }, shadows.card]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '600' }}>
              {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'User'}
            </Text>
            <Text style={{ color: colors.text.tertiary, marginTop: 2 }}>{user?.email ?? ''}</Text>
            {user?.roles && user.roles.length > 0 && <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600', marginTop: 4 }}>{user.roles.join(', ')}</Text>}
          </View>
        </View>

        {/* Company Info */}
        {companySettings && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg, margin: spacing.md }, shadows.card]}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('settings.companyInfo')}</Text>
            <SettingRow icon="business-outline" title={companySettings.companyName || t('settings.companyName')} subtitle={t('settings.companyInfo')} onPress={() => navigation.navigate('CompanySetup')} />
          </View>
        )}

        {/* Account */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg, margin: spacing.md }, shadows.card]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('settings.account')}</Text>
          <SettingRow icon="lock-closed-outline" title={t('settings.changePassword')} onPress={() => setShowPassword(true)} />
        </View>

        {/* Preferences */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg, margin: spacing.md }, shadows.card]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('settings.preferences')}</Text>
          <SettingRow
            icon="language-outline"
            title={t('settings.language')}
            subtitle={languages.find(l => l.code === i18n.language)?.label ?? 'English'}
            onPress={() => setShowLanguage(true)}
          />
          <SettingRow
            icon="moon-outline"
            title={t('settings.darkMode')}
            onPress={() => setThemeMode(dark ? 'light' : 'dark')}
            trailing={
              <Switch
                value={dark}
                onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')}
                thumbColor={dark ? colors.primary : '#f4f3f4'}
                trackColor={{ false: '#767577', true: colors.primary + '60' }}
              />
            }
          />
        </View>

        {/* Logout */}
        <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.lg }}>
          <Button
            title={t('settings.logout')}
            variant="danger"
            onPress={handleLogout}
            fullWidth
            icon={<Ionicons name="log-out-outline" size={20} color="#FFF" />}
          />
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showPassword}
        onClose={() => setShowPassword(false)}
        title={t('settings.changePassword')}
        footer={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={() => setShowPassword(false)} style={{ flex: 1 }} />
            <Button title={t('common.save')} variant="primary" onPress={handleChangePassword} loading={changePasswordMutation.isPending} style={{ flex: 1 }} />
          </View>
        }
      >
        <Input
          label={t('settings.currentPassword')}
          value={passwordForm.currentPassword}
          onChangeText={(v) => setPasswordForm(p => ({ ...p, currentPassword: v }))}
          secureTextEntry
        />
        <Input
          label={t('settings.newPassword')}
          value={passwordForm.newPassword}
          onChangeText={(v) => setPasswordForm(p => ({ ...p, newPassword: v }))}
          secureTextEntry
        />
        <Input
          label={t('settings.confirmPassword')}
          value={passwordForm.confirmPassword}
          onChangeText={(v) => setPasswordForm(p => ({ ...p, confirmPassword: v }))}
          secureTextEntry
        />
      </Modal>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguage}
        onClose={() => setShowLanguage(false)}
        title={t('settings.language')}
      >
        {languages.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.langRow, { borderBottomColor: colors.divider }]}
            onPress={() => handleLanguageChange(lang.code)}
          >
            <Text style={{ color: i18n.language === lang.code ? colors.primary : colors.text.primary, fontWeight: i18n.language === lang.code ? '700' : '400', fontSize: 16 }}>
              {lang.label}
            </Text>
            {i18n.language === lang.code && <Ionicons name="checkmark" size={22} color={colors.primary} />}
          </TouchableOpacity>
        ))}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontWeight: '700' },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  section: { borderWidth: 1, overflow: 'hidden' },
  sectionTitle: { fontWeight: '700', fontSize: 15, padding: 16, paddingBottom: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  settingIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  langRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
});
