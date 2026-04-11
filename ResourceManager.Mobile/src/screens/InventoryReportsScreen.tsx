import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
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
  const { data: report, isLoading: loadingReport } = useInventoryReport();

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
            <Text style={styles.summaryValue}>{valuation?.totalValue?.toLocaleString() ?? '0'}</Text>
          </View>
        </View>

        {/* Valuation Items */}
        <View style={{ paddingHorizontal: spacing.md }}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('inventory.valuationBreakdown')}</Text>
          {(valuation?.items ?? []).map((item, idx) => (
            <View key={idx} style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text.primary, fontWeight: '500' }}>{item.productName}</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>Qty: {item.quantity} @ {item.unitPrice.toLocaleString()}</Text>
              </View>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>{item.totalValue.toLocaleString()}</Text>
            </View>
          ))}
        </View>

        {/* Usage Report */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.lg }}>
          <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }, shadows.card]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <Ionicons name="trending-up-outline" size={22} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text.primary, marginLeft: 8, marginBottom: 0 }]}>{t('inventory.usageReport')}</Text>
            </View>
            <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.text.tertiary }}>{t('inventory.totalMovements')}</Text>
              <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 18 }}>{report?.totalMovements ?? 0}</Text>
            </View>
            <Text style={{ color: colors.text.secondary, fontWeight: '600', marginTop: spacing.md, marginBottom: 8 }}>{t('inventory.topProducts')}</Text>
            {(report?.topProducts ?? []).map((item, idx) => (
              <View key={idx} style={[styles.topRow, { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[styles.rank, { backgroundColor: colors.primaryLight }]}>
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{idx + 1}</Text>
                  </View>
                  <Text style={{ color: colors.text.primary, marginLeft: 8 }}>{item.productName}</Text>
                </View>
                <Text style={{ color: colors.text.secondary, fontWeight: '600' }}>{item.totalUsed}</Text>
              </View>
            ))}
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
  sectionTitle: { fontWeight: '700', fontSize: 16, marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 14, marginBottom: 8 },
  reportCard: { borderWidth: 1, padding: 16 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  rank: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});
