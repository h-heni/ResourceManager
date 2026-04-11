import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { usePurchaseOrders, useDeletePurchaseOrder, useUpdatePurchaseOrderStatus, useReceivePurchaseOrder } from '../hooks/useInventory';
import type { PurchaseOrder } from '../api/inventory';
import SearchBar from '../components/SearchBar';
import FilterChips from '../components/FilterChips';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { ConfirmDeleteModal } from '../components';

export default function PurchaseOrdersScreen({ navigation }: any) {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);

  const { data, isLoading, isRefetching } = usePurchaseOrders(statusFilter);
  const deleteMutation = useDeletePurchaseOrder();
  const updateStatusMutation = useUpdatePurchaseOrderStatus();
  const receiveMutation = useReceivePurchaseOrder();

  const statusOptions = ['All', 'Draft', 'Sent', 'Received', 'Cancelled'];

  const filtered = (data?.items ?? []).filter((po) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return po.poNumber?.toLowerCase().includes(s) || po.supplierName?.toLowerCase().includes(s);
  });

  const getStatusType = (status: string): any => {
    const map: Record<string, any> = { Draft: 'default', Sent: 'warning', Received: 'success', Cancelled: 'error' };
    return map[status] || 'default';
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

  const handleStatusChange = (po: PurchaseOrder, newStatus: string) => {
    Alert.alert(t('inventory.updateStatus'), `${t('inventory.changeStatusTo')} ${newStatus}?`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), onPress: () => updateStatusMutation.mutate({ id: po.id, status: newStatus }) },
    ]);
  };

  const handleReceive = (po: PurchaseOrder) => {
    Alert.alert(t('inventory.receivePO'), t('inventory.receiveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), onPress: () => receiveMutation.mutate(po.id) },
    ]);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  const renderItem = ({ item }: { item: PurchaseOrder }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}
      onLongPress={() => setDeleteTarget(item)}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        <Text style={[styles.poNumber, { color: colors.primary }]}>#{item.poNumber}</Text>
        <StatusBadge status={getStatusType(item.status)} text={item.status} />
      </View>
      <View style={[styles.row, { marginTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>{t('inventory.supplier')}</Text>
          <Text style={{ color: colors.text.secondary }}>{item.supplierName}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>{t('inventory.expectedDate')}</Text>
          <Text style={{ color: colors.text.secondary }}>{formatDate(item.expectedDeliveryDate)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>{t('inventory.total')}</Text>
          <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{item.totalAmount.toLocaleString()}</Text>
        </View>
      </View>
      {/* Quick actions */}
      <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
        {item.status === 'Draft' && (
          <TouchableOpacity style={[styles.actionChip, { backgroundColor: colors.primaryLight }]} onPress={() => handleStatusChange(item, 'Sent')}>
            <Ionicons name="send-outline" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, marginLeft: 4 }}>{t('inventory.send')}</Text>
          </TouchableOpacity>
        )}
        {item.status === 'Sent' && (
          <TouchableOpacity style={[styles.actionChip, { backgroundColor: '#14B8A6' + '15' }]} onPress={() => handleReceive(item)}>
            <Ionicons name="checkmark-circle-outline" size={14} color="#14B8A6" />
            <Text style={{ color: '#14B8A6', fontSize: 12, marginLeft: 4 }}>{t('inventory.receive')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.actionChip, { backgroundColor: colors.error + '15' }]} onPress={() => setDeleteTarget(item)}>
          <Ionicons name="trash-outline" size={14} color={colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('inventory.purchaseOrders')}</Text>
            <Text style={{ color: colors.text.tertiary, marginTop: 2 }}>{data?.totalCount ?? 0} {t('inventory.orders')}</Text>
          </View>
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
        <FilterChips
          options={statusOptions}
          selected={statusFilter || 'All'}
          onSelect={(v) => setStatusFilter(v === 'All' ? undefined : v)}
        />
      </View>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState title={t('inventory.noPurchaseOrders')} icon={<Ionicons name="cart-outline" size={48} color={colors.text.light} />} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
      <ConfirmDeleteModal
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        title={t('inventory.deletePO')}
        message={t('inventory.deletePOMessage')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontWeight: '700' },
  card: { borderWidth: 1, padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  poNumber: { fontSize: 16, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  actionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
});
