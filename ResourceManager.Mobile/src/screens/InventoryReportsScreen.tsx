import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { useInventoryValuation, useInventoryReport } from '../hooks/useInventory';

export default function InventoryReportsScreen({ navigation }: any) {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const { data: valuation, isLoading: loadingVal } = useInventoryValuation();
  const { data: turnover, isLoading: loadingReport } = useInventoryReport();

  if (loadingVal || loadingReport) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('inventory.reports')}</Text>
          </View>
        </View>

        {/* Valuation Summary */}
        <View style={{ padding: spacing.md }}>
          <View style={[styles.summaryCard, { backgroundColor: colors.primary, borderRadius: borderRadius.lg }]}>
            <Ionicons name="stats-chart-outline" size={28} color="#FFF" />
            <Text style={styles.summaryLabel}>{t('inventory.totalValuation')}</Text>
            <Text style={styles.summaryValue}>{valuation?.totalStockValue?.toLocaleString() ?? '0'}</Text>
          </View>

          {/* Stats Row */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <View style={[styles.miniCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md, flex: 1 }]}>
              <Text style={{ color: colors.warning, fontSize: 22, fontWeight: '700' }}>{valuation?.lowStockCount ?? 0}</Text>
              <Text style={{ color: colors.text.tertiary, fontSize: 11 }}>{t('inventory.lowStock')}</Text>
            </View>
            <View style={[styles.miniCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md, flex: 1 }]}>
              <Text style={{ color: colors.error, fontSize: 22, fontWeight: '700' }}>{valuation?.outOfStockCount ?? 0}</Text>
              <Text style={{ color: colors.text.tertiary, fontSize: 11 }}>{t('inventory.outOfStock')}</Text>
            </View>
            <View style={[styles.miniCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md, flex: 1 }]}>
              <Text style={{ color: colors.success, fontSize: 22, fontWeight: '700' }}>{valuation?.totalProducts ?? 0}</Text>
              <Text style={{ color: colors.text.tertiary, fontSize: 11 }}>{t('inventory.totalProducts')}</Text>
            </View>
          </View>
        </View>

        {/* Valuation Items */}
        <View style={{ paddingHorizontal: spacing.md }}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('inventory.valuationBreakdown')}</Text>
          {(valuation?.items ?? []).map((item, idx) => (
            <View key={idx} style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text.primary, fontWeight: '500' }}>{item.productName}</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>
                  {t('inventory.qty')}: {item.currentStock} @ {item.defaultUnitPrice.toLocaleString()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>{item.stockValue.toLocaleString()}</Text>
                <Text style={[styles.statusBadge, {
                  backgroundColor: item.stockStatus === 'OutOfStock' ? colors.error + '20' : item.stockStatus === 'LowStock' ? colors.warning + '20' : colors.success + '20',
                  color: item.stockStatus === 'OutOfStock' ? colors.error : item.stockStatus === 'LowStock' ? colors.warning : colors.success,
                }]}>{item.stockStatus}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Turnover Report */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.lg }}>
          <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }, shadows.card]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <Ionicons name="trending-up-outline" size={22} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text.primary, marginLeft: 8, marginBottom: 0 }]}>{t('inventory.turnoverReport')}</Text>
            </View>
            {(!turnover || turnover.length === 0) ? (
              <Text style={{ color: colors.text.tertiary, textAlign: 'center', paddingVertical: 16 }}>{t('common.noData')}</Text>
            ) : (
              turnover.map((item, idx) => (
                <View key={item.productServiceId} style={[styles.topRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={[styles.rank, { backgroundColor: colors.primaryLight }]}>
                      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{idx + 1}</Text>
                    </View>
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text style={{ color: colors.text.primary }}>{item.productName}</Text>
                      <Text style={{ color: colors.text.tertiary, fontSize: 11 }}>{t('inventory.sold')}: {item.totalSold} · {t('inventory.rate')}: {item.turnoverRate.toFixed(2)}</Text>
                    </View>
                  </View>
                  {item.isDeadStock && (
                    <View style={[styles.deadStockBadge, { backgroundColor: colors.error + '20' }]}>
                      <Text style={{ color: colors.error, fontSize: 10, fontWeight: '600' }}>{t('inventory.deadStock')}</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontWeight: '700' },
  summaryCard: { padding: 24, alignItems: 'center', gap: 8 },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  summaryValue: { color: '#FFF', fontSize: 32, fontWeight: '700' },
  miniCard: { borderWidth: 1, padding: 12, alignItems: 'center' },
  sectionTitle: { fontWeight: '700', fontSize: 16, marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 14, marginBottom: 8 },
  statusBadge: { fontSize: 10, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  reportCard: { borderWidth: 1, padding: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rank: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  deadStockBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
