import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { supplierInvoicesApi, type SupplierInvoice } from '../api/supplierInvoices';
import SearchBar from '../components/SearchBar';
import FilterChips from '../components/FilterChips';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { ConfirmDeleteModal } from '../components';

export default function SupplierInvoicesListScreen({ navigation }: any) {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deleteTarget, setDeleteTarget] = useState<SupplierInvoice | null>(null);

  const { data, isLoading, isRefetching } = useQuery({
    queryKey: ['supplier-invoices'],
    queryFn: () => supplierInvoicesApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => supplierInvoicesApi.getById(id).then(() => { throw new Error('delete not yet implemented'); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      setDeleteTarget(null);
    },
  });

  const statusOptions = ['All', 'Paid', 'Pending', 'PartiallyPaid'];
  const items = (data?.data ?? []).filter((inv) => {
    if (statusFilter !== 'All' && inv.paymentStatus !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return inv.invoiceNumber?.toLowerCase().includes(s) || inv.supplierName?.toLowerCase().includes(s);
  });

  const getStatusType = (status: string): any => {
    const map: Record<string, any> = { Paid: 'success', PartiallyPaid: 'warning', Pending: 'warning' };
    return map[status] || 'default';
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  };

  const renderItem = ({ item }: { item: SupplierInvoice }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}
      onPress={() => navigation.navigate('SupplierInvoiceDetail', { invoiceId: item.id })}
      onLongPress={() => setDeleteTarget(item)}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        <Text style={[styles.number, { color: colors.primary }]}>#{item.invoiceNumber}</Text>
        <StatusBadge status={getStatusType(item.paymentStatus)} text={item.paymentStatus} />
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }}>{t('supplierInvoice.supplier')}</Text>
          <Text style={{ color: colors.text.secondary }}>{item.supplierName || '-'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }}>{t('supplierInvoice.date')}</Text>
          <Text style={{ color: colors.text.secondary }}>{formatDate(item.invoiceDate)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }}>{t('supplierInvoice.total')}</Text>
          <Text style={[styles.amount, { color: colors.text.primary }]}>{item.totalTTC.toLocaleString()} {item.currencySymbol || 'TND'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('supplierInvoice.title')}</Text>
          <TouchableOpacity
            style={[styles.scanFab, { backgroundColor: colors.primary, borderRadius: borderRadius.full }]}
            onPress={() => navigation.navigate('ScanTab')}
          >
            <Ionicons name="camera-outline" size={18} color="#FFF" />
            <Text style={styles.scanFabText}>{t('supplierInvoice.scanNew')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: colors.text.tertiary, marginTop: 4 }}>{data?.totalCount ?? 0} {t('supplierInvoice.supplierInvoices')}</Text>
      </View>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
        <FilterChips options={statusOptions} selected={statusFilter} onSelect={setStatusFilter} />
      </View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState title={t('supplierInvoice.noInvoices')} message={t('supplierInvoice.noInvoicesMessage')} icon={<Ionicons name="receipt-outline" size={48} color={colors.text.light} />} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
      <ConfirmDeleteModal
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        title={t('supplierInvoice.deleteTitle')}
        message={t('supplierInvoice.deleteMessage')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700' },
  scanFab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  scanFabText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  card: { borderWidth: 1, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  number: { fontSize: 16, fontWeight: '600' },
  amount: { fontSize: 16, fontWeight: '700' },
});
