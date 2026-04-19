import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-gifted-charts';
import { useAppTheme } from '../theme/ThemeContext';
import { useDashboardStats, useRevenueSummary, usePurchasesSummary, useTopClients } from '../hooks/useDashboard';
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
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [dashboardMode, setDashboardMode] = useState<'single' | 'mixed'>('single');
  const [currencyFilter, setCurrencyFilter] = useState<string | undefined>(undefined);

  const effectiveCurrency = dashboardMode === 'mixed' ? undefined : currencyFilter;
  const { data: stats, isLoading: statsLoading, isRefetching } = useDashboardStats(year, effectiveCurrency);
  const { data: revenueSummary } = useRevenueSummary(year, effectiveCurrency);
  const { data: purchasesSummary } = usePurchasesSummary(year, effectiveCurrency);
  const { data: invoicesData } = useInvoices(1, 5);
  const { data: topClients } = useTopClients(year, effectiveCurrency);
  const { data: stockAlerts = [] } = useStockAlerts();

  useEffect(() => {
    if (stats?.selectedCurrency && !currencyFilter) {
      setCurrencyFilter(stats.selectedCurrency);
    }
  }, [stats?.selectedCurrency, currencyFilter]);

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

  const getStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      Paid: t('invoice.statusPaid'),
      PartiallyPaid: t('invoice.statusPartial'),
      Pending: t('invoice.statusPending'),
      Overdue: t('invoice.statusOverdue'),
      Draft: t('invoice.statusDraft'),
      Archived: t('invoice.statusArchived'),
    };
    return map[status] || status;
  };

  if (statsLoading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: spacing.xxl + insets.bottom }}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('dashboard.title')}</Text>
          <Text style={{ color: colors.text.tertiary, marginTop: 4 }}>{dashboardMode === 'mixed' ? t('dashboard.mixed') : (stats?.selectedCurrency || 'TND')}</Text>
        </View>

        {/* Mode Toggle */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <View style={[styles.modeToggle, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }]}>
            <TouchableOpacity
              style={[styles.modeOption, dashboardMode === 'single' && { backgroundColor: colors.primary + '22' }]}
              onPress={() => setDashboardMode('single')}
              activeOpacity={0.8}
            >
              <Text style={{ color: dashboardMode === 'single' ? colors.primary : colors.text.secondary, fontWeight: '600' }}>{t('dashboard.perCurrency')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeOption, dashboardMode === 'mixed' && { backgroundColor: colors.primary + '22' }]}
              onPress={() => setDashboardMode('mixed')}
              activeOpacity={0.8}
            >
              <Text style={{ color: dashboardMode === 'mixed' ? colors.primary : colors.text.secondary, fontWeight: '600' }}>{t('dashboard.mixed')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Year Selector */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <YearSelector value={year} onChange={setYear} />
        </View>

        {/* KPI Cards Row 1 */}
        <View style={styles.kpiRow}>
          <StatCard icon="cash-outline" label={t('dashboard.totalRevenue')} value={formatAmount(stats?.totalRevenue)} delta={stats?.growthDisplay ?? ''} deltaPositive={(stats?.growthPercentage ?? 0) >= 0} accentColor={colors.success} />
          <StatCard icon="receipt-outline" label={t('dashboard.invoiceCount')} value={String(stats?.totalInvoiceCount ?? 0)} accentColor={colors.info} />
        </View>

        {/* Yearly Totals */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.sm }}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}>
            <Text style={{ color: colors.text.primary, fontWeight: '700', marginBottom: 8 }}>{t('dashboard.yearlySummary')}</Text>
            <View style={styles.summaryRow}>
              <Text style={{ color: colors.text.tertiary }}>{t('dashboard.revenueByYear')}</Text>
              <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{formatAmount(revenueSummary?.selectedYearTotal)} {stats?.selectedCurrency || 'TND'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={{ color: colors.text.tertiary }}>{t('dashboard.expensesByYear')}</Text>
              <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{formatAmount(purchasesSummary?.selectedYearTotal)} {stats?.selectedCurrency || 'TND'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={{ color: colors.text.tertiary }}>{t('dashboard.netResult')}</Text>
              <Text style={{ color: colors.text.primary, fontWeight: '700' }}>
                {formatAmount((revenueSummary?.selectedYearTotal ?? 0) - (purchasesSummary?.selectedYearTotal ?? 0))} {stats?.selectedCurrency || 'TND'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.kpiRow}>
          <StatCard icon="wallet-outline" label={t('dashboard.totalExpenses')} value={formatAmount(stats?.totalExpenses)} accentColor={colors.warning} />
          <StatCard icon="alert-circle-outline" label={t('dashboard.outstanding')} value={formatAmount(outstanding)} accentColor={colors.error} />
        </View>

        {/* Revenue Chart */}
        {chartData.length > 0 && (
          <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
            <ChartCard title={t('dashboard.revenueOverTime')}>
              <LineChart
                data={chartData}
                adjustToWidth
                parentWidth={Dimensions.get('window').width - spacing.md * 2 - 32}
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
                isAnimated={false}
                initialSpacing={8}
                endSpacing={8}
              />
            </ChartCard>
          </View>
        )}

        {/* Status Summary */}
        <View style={[styles.statusRow, { paddingHorizontal: spacing.md }]}>
          {[
            { label: t('dashboard.paidInvoices'), value: stats?.paidInvoiceCount ?? 0, color: colors.success },
            { label: t('dashboard.pendingInvoices'), value: stats?.pendingInvoicesCount ?? 0, color: colors.warning },
            { label: t('dashboard.partialInvoices'), value: stats?.partiallyPaidCount ?? 0, color: colors.info },
            { label: t('dashboard.overdueInvoices'), value: stats?.overdueCount ?? 0, color: colors.error },
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
        <View style={{ paddingHorizontal: spacing.md }}>
          {(invoicesData?.items ?? []).slice(0, 5).map((inv) => (
            <TouchableOpacity
              key={inv.id}
              style={[styles.invoiceRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}
              onPress={() => navigation.navigate('SalesTab', { screen: 'InvoiceDetail', params: { invoiceId: inv.id } })}
              activeOpacity={0.7}
            >
              {/* Left: invoice number + client */}
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={[styles.invNumber, { color: colors.primary }]} numberOfLines={1}>#{inv.number}</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }} numberOfLines={1}>{inv.clientName}</Text>
              </View>
              {/* Center: amount */}
              <Text style={[styles.invAmount, { color: colors.text.primary }]} numberOfLines={1}>
                {inv.totalAmount.toLocaleString()} {inv.currencySymbol || 'TND'}
              </Text>
              {/* Right: status badge */}
              <View style={{ marginLeft: spacing.sm, flexShrink: 0 }}>
                <StatusBadge status={getStatusType(inv.status)} text={getStatusLabel(inv.status)} />
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
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  statusCard: { flex: 1, minWidth: '45%', alignItems: 'center', padding: 12, borderWidth: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
  statusVal: { fontSize: 20, fontWeight: '700' },
  statusLbl: { marginTop: 2 },
  modeToggle: { flexDirection: 'row', borderWidth: 1, padding: 4 },
  modeOption: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  summaryCard: { borderWidth: 1, padding: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 10 },
  scanBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  invoiceRow: { flexDirection: 'row', padding: 14, borderWidth: 1, marginBottom: 10, alignItems: 'center' },
  invNumber: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  invAmount: { fontSize: 14, fontWeight: '700', textAlign: 'right', flexShrink: 0 },
  rankBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  alertIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
});
