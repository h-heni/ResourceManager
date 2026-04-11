import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { useStockAlerts } from '../hooks';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import type { StockAlert } from '../api/inventory';

export default function StockAlertsScreen() {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const { data: alerts = [], isLoading, refetch, isRefetching } = useStockAlerts();

  const getSeverityType = (severity: string): any => {
    const map: Record<string, any> = { Critical: 'error', High: 'error', Medium: 'warning', Low: 'info' };
    return map[severity] || 'default';
  };

  const renderItem = ({ item }: { item: StockAlert }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.warning + '15' }]}>
          <Ionicons name="warning-outline" size={20} color={colors.warning} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[styles.name, { color: colors.text.primary }]}>{item.productName}</Text>
          <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }}>{item.warehouseName}</Text>
        </View>
        <StatusBadge status={getSeverityType(item.severity)} text={item.severity} />
      </View>
      <View style={[styles.detail, { borderTopColor: colors.border }]}>
        <View style={styles.detailItem}>
          <Text style={{ color: colors.text.tertiary, fontSize: 11 }}>{t('stockAlerts.current')}</Text>
          <Text style={{ color: colors.error, fontWeight: '700', fontSize: 16 }}>{item.currentQuantity}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={{ color: colors.text.tertiary, fontSize: 11 }}>{t('stockAlerts.reorder')}</Text>
          <Text style={{ color: colors.warning, fontWeight: '600', fontSize: 16 }}>{item.reorderPoint}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={{ color: colors.text.tertiary, fontSize: 11 }}>{t('stockAlerts.deficit')}</Text>
          <Text style={{ color: colors.error, fontWeight: '700', fontSize: 16 }}>{item.reorderPoint - item.currentQuantity}</Text>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Ionicons name="alert-circle" size={24} color={colors.warning} />
          <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1, marginLeft: 8 }]}>{t('stockAlerts.title')}</Text>
        </View>
        <Text style={{ color: colors.text.tertiary, marginTop: 4 }}>{alerts.length} {t('stockAlerts.activeAlerts')}</Text>
      </View>
      <FlatList
        data={alerts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState title={t('stockAlerts.noAlerts')} message={t('stockAlerts.noAlertsMessage')} icon={<Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontWeight: '700' },
  card: { borderWidth: 1, padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  name: { fontWeight: '600', fontSize: 15 },
  detail: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  detailItem: { flex: 1, alignItems: 'center' },
});
