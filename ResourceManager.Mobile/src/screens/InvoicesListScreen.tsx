import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { useInvoices, useDeleteInvoice } from '../hooks/useInvoice';
import type { Invoice } from '../api/invoices';
import SearchBar from '../components/SearchBar';
import FilterChips from '../components/FilterChips';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { FABButton, ConfirmDeleteModal } from '../components';

export default function InvoicesListScreen({ navigation }: any) {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  const { data, isLoading, isRefetching } = useInvoices(1, 20);
  const deleteMutation = useDeleteInvoice();

  const statusOptions = ['All', 'Paid', 'PartiallyPaid', 'Pending', 'Overdue'];

  const filtered = (data?.items ?? []).filter((inv) => {
    if (statusFilter !== 'All' && inv.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return inv.number?.toLowerCase().includes(s) || inv.clientName?.toLowerCase().includes(s);
  });

  const getStatusType = (status: string): any => {
    const map: Record<string, any> = { Paid: 'success', PartiallyPaid: 'warning', Pending: 'warning', Overdue: 'error', Archived: 'default' };
    return map[status] || 'default';
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const renderItem = ({ item }: { item: Invoice }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}
      onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}
      onLongPress={() => setDeleteTarget(item)}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        <Text style={[styles.number, { color: colors.primary }]}>#{item.number}</Text>
        <StatusBadge status={getStatusType(item.status)} text={item.status} />
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }}>{t('invoice.client')}</Text>
          <Text style={{ color: colors.text.secondary }}>{item.clientName}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }}>{t('invoice.date')}</Text>
          <Text style={{ color: colors.text.secondary }}>{formatDate(item.date)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }}>{t('invoice.total')}</Text>
          <Text style={[styles.amount, { color: colors.text.primary }]}>{item.totalAmount.toLocaleString()} {item.currencySymbol || 'TND'}</Text>
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
        <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('invoice.title')}</Text>
        <Text style={{ color: colors.text.tertiary, marginTop: 4 }}>{data?.totalCount ?? 0} {t('invoice.invoices')}</Text>
      </View>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
        <FilterChips options={statusOptions} selected={statusFilter} onSelect={setStatusFilter} />
      </View>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState title={t('invoice.noInvoices')} message={t('invoice.noInvoicesMessage')} icon={<Ionicons name="document-text-outline" size={48} color={colors.text.light} />} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['invoices'] })} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
      <FABButton onPress={() => navigation.navigate('InvoiceCreate')} />
      <ConfirmDeleteModal
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        title={t('invoice.deleteTitle')}
        message={t('invoice.deleteMessage')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontWeight: '700' },
  card: { borderWidth: 1, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  number: { fontSize: 16, fontWeight: '600' },
  amount: { fontSize: 16, fontWeight: '700' },
});
