import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  route: string;
  color: string;
}

export default function MoreMenuScreen({ navigation }: any) {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();

  const menuSections: { titleKey: string; items: MenuItem[] }[] = [
    {
      titleKey: 'more.directory',
      items: [
        { icon: 'people-outline', labelKey: 'client.title', route: 'ClientsList', color: '#6366F1' },
        { icon: 'cube-outline', labelKey: 'product.title', route: 'ProductsList', color: '#EC4899' },
      ],
    },
    {
      titleKey: 'more.inventory',
      items: [
        { icon: 'layers-outline', labelKey: 'inventory.title', route: 'InventoryList', color: '#14B8A6' },
        { icon: 'alert-circle-outline', labelKey: 'stockAlerts.title', route: 'StockAlerts', color: '#F59E0B' },
      ],
    },
    {
      titleKey: 'more.management',
      items: [
        { icon: 'people-circle-outline', labelKey: 'users.title', route: 'Users', color: '#8B5CF6' },
      ],
    },
    {
      titleKey: 'more.settings',
      items: [
        { icon: 'settings-outline', labelKey: 'settings.title', route: 'Settings', color: '#64748B' },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('nav.more')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        {menuSections.map((section) => (
          <View key={section.titleKey} style={{ marginBottom: spacing.lg }}>
            <Text style={[styles.sectionTitle, { color: colors.text.tertiary }]}>{t(section.titleKey)}</Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.route}
                  style={[
                    styles.menuRow,
                    idx < section.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                  onPress={() => navigation.navigate(item.route)}
                  activeOpacity={0.6}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  <Text style={[styles.menuLabel, { color: colors.text.primary }]}>{t(item.labelKey)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.text.light} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  sectionCard: { borderWidth: 1, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  iconWrap: { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontWeight: '500', fontSize: 16, marginLeft: 14 },
});
