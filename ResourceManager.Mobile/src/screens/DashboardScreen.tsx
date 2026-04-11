import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-gifted-charts';
import { useAppTheme } from '../theme/ThemeContext';
import { useDashboardStats, useRevenueSummary, useTopClients } from '../hooks/useDashboard';
import { useInvoices } from '../hooks/useInvoice';
import { useStockAlerts } from '../hooks/useDirectory';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import SectionHeader from '../components/SectionHeader';
import StatusBadge from '../components/StatusBadge';
import { YearSelector } from '../components';

export default function DashboardScreen({ navigation }: any) {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: stats, isLoading: statsLoading, isRefetching } = useDashboardStats(year);
  const { data: revenueSummary } = useRevenueSummary(year);
  const { data: invoicesData } = useInvoices(1, 5);
  const { data: topClients } = useTopClients(year);
  const { data: stockAlerts = [] } = useStockAlerts();

  const formatAmount = (val?: number) =>
    (val ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Use the monthly revenueChart from stats (already month-by-month for current year)
  const chartData = (stats?.revenueChart ?? []).map((p) => ({
    value: p.amount,
    label: p.label?.substring(0, 3) ?? String(p.month),
    dataPointText: '',
  }));

  const outstanding = stats?.pendingInvoicesAmount ?? 0;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['revenue-summary'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['top-clients'] });
    queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
  };

  const getStatusType = (status: string): any => {
    const map: Record<string, any> = { Paid: 'success', PartiallyPaid: 'warning', Pending: 'warning', Overdue: 'error' };
    return map[status] || 'default';
  };

  if (statsLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('dashboard.title')}</Text>
        </View>

        {/* Year Selector */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <YearSelector year={year} onYearChange={setYear} />
        </View>

        {/* KPI Cards Row 1 */}
        <View style={styles.kpiRow}>
          <StatCard icon="cash-outline" label={t('dashboard.totalRevenue')} value={formatAmount(stats?.totalRevenue)} delta={stats?.growthDisplay ?? ''} deltaPositive={(stats?.growthPercentage ?? 0) >= 0} accentColor={colors.success} />
          <StatCard icon="receipt-outline" label={t('dashboard.invoiceCount')} value={String(stats?.totalInvoiceCount ?? 0)} accentColor={colors.info} />
        </View>
        <View style={styles.kpiRow}>
          <StatCard icon="wallet-outline" label={t('dashboard.totalExpenses')} value={formatAmount(stats?.totalExpenses)} accentColor={colors.warning} />
          <StatCard icon="alert-circle-outline" label={t('dashboard.outstanding')} value={formatAmount(outstanding)} accentColor={colors.error} />
        </View>

        {/* Revenue Chart */}
        {chartData.length > 0 && (
          <View style={{ paddingHorizontal: spacing.md }}>
            <ChartCard title={t('dashboard.revenueOverTime')}>
              <LineChart
                data={chartData}
                width={280}
                height={160}
                color={colors.primary}
                dataPointsColor={colors.primary}
                startFillColor={colors.primary + '30'}
                endFillColor={colors.primary + '05'}
                areaChart
                curved
                hideRules
                yAxisTextStyle={{ color: colors.text.tertiary, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: colors.text.tertiary, fontSize: 10 }}
                noOfSections={4}
                xAxisColor={colors.border}
                yAxisColor={colors.border}
              />
            </ChartCard>
          </View>
        )}

        {/* Status Summary */}
        <View style={[styles.statusRow, { paddingHorizontal: spacing.md }]}>
          {[
            { label: t('dashboard.paidInvoices'), value: stats?.paidInvoiceCount ?? 0, color: colors.success },
            { label: t('dashboard.pendingInvoices'), value: stats?.pendingInvoicesCount ?? 0, color: colors.warning },
            { label: t('dashboard.overdueInvoices'), value: stats?.partiallyPaidCount ?? 0, color: colors.error },
          ].map((item) => (
            <View key={item.label} style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}>
              <View style={[styles.statusDot, { backgroundColor: item.color }]} />
              <Text style={[styles.statusVal, { color: colors.text.primary }]}>{item.value}</Text>
              <Text style={[styles.statusLbl, { color: colors.text.tertiary, fontSize: typography.fontSize.xs }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
          <TouchableOpacity
            style={[styles.scanBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.lg }]}
            onPress={() => navigation.navigate('ScanTab')}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={22} color="#FFF" />
            <Text style={styles.scanBtnText}>{t('dashboard.scanInvoice')}</Text>
          </TouchableOpacity>
        </View>

        {/* Top Clients */}
        {topClients && topClients.length > 0 && (
          <>
            <SectionHeader title={t('dashboard.topClients')} />
            <View style={{ paddingHorizontal: spacing.md }}>
              {topClients.slice(0, 5).map((client, idx) => (
                <View key={idx} style={[styles.invoiceRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}>
                  <View style={[styles.rankBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{client.clientName}</Text>
                    <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>{client.invoiceCount} {t('dashboard.invoicesCount')}</Text>
                  </View>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>{client.totalRevenue.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Stock Alerts */}
        {stockAlerts.length > 0 && (
          <>
            <SectionHeader title={t('dashboard.stockAlerts')} actionLabel={t('common.viewAll')} onAction={() => navigation.navigate('InventoryTab')} />
            <View style={{ paddingHorizontal: spacing.md }}>
              {stockAlerts.slice(0, 3).map((alert) => (
                <View key={alert.id} style={[styles.invoiceRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}>
                  <View style={[styles.alertIcon, { backgroundColor: alert.currentQuantity <= 0 ? colors.error + '15' : colors.warning + '15' }]}>
                    <Ionicons name="warning-outline" size={18} color={alert.currentQuantity <= 0 ? colors.error : colors.warning} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: colors.text.primary, fontWeight: '500' }}>{alert.productName}</Text>
                    <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>{alert.warehouseName}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: alert.currentQuantity <= 0 ? colors.error : colors.warning, fontWeight: '700' }}>{alert.currentQuantity}</Text>
                    <Text style={{ color: colors.text.tertiary, fontSize: 11 }}>/ {alert.reorderPoint}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Recent Invoices */}
        <SectionHeader title={t('dashboard.recentInvoices')} actionLabel={t('common.viewAll')} onAction={() => navigation.navigate('SalesTab')} />
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl }}>
          {(invoicesData?.items ?? []).slice(0, 5).map((inv) => (
            <TouchableOpacity
              key={inv.id}
              style={[styles.invoiceRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}
              onPress={() => navigation.navigate('SalesTab', { screen: 'InvoiceDetail', params: { invoiceId: inv.id } })}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.invNumber, { color: colors.primary }]}>#{inv.number}</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }}>{inv.clientName}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.invAmount, { color: colors.text.primary }]}>{inv.totalAmount.toLocaleString()} {inv.currencySymbol || 'TND'}</Text>
                <StatusBadge status={getStatusType(inv.status)} text={inv.status} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontWeight: '700' },
  kpiRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 12 },
  statusRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statusCard: { flex: 1, alignItems: 'center', padding: 12, borderWidth: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
  statusVal: { fontSize: 20, fontWeight: '700' },
  statusLbl: { marginTop: 2 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 10 },
  scanBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  invoiceRow: { flexDirection: 'row', padding: 14, borderWidth: 1, marginBottom: 10 },
  invNumber: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  invAmount: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  rankBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  alertIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
});
