import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput, Modal as RNModal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { useStockLevels } from '../hooks';
import { useAdjustStock } from '../hooks/useInventory';
import SearchBar from '../components/SearchBar';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Input from '../components/Input';
import type { StockLevel } from '../api/inventory';

export default function InventoryListScreen({ navigation }: any) {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<StockLevel | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const { data: stockData, isLoading, refetch, isRefetching } = useStockLevels();
  const adjustMutation = useAdjustStock();

  const stockLevels = Array.isArray(stockData) ? stockData : (stockData?.items ?? []);

  const filtered = stockLevels.filter((s) => {
    if (!search) return true;
    return s.productName.toLowerCase().includes(search.toLowerCase()) || s.warehouseName.toLowerCase().includes(search.toLowerCase());
  });

  const getStatusInfo = (item: StockLevel): { type: any; label: string } => {
    if (item.currentQuantity <= 0) return { type: 'error', label: t('inventory.outOfStock') };
    if (item.currentQuantity <= item.reorderPoint) return { type: 'warning', label: t('inventory.low') };
    return { type: 'success', label: t('inventory.inStock') };
  };

  const handleAdjust = () => {
    if (!adjustTarget || !adjustQty) return;
    adjustMutation.mutate(
      { productId: adjustTarget.productId, quantity: parseInt(adjustQty), reason: adjustReason || 'Manual adjustment' },
      { onSuccess: () => { setAdjustTarget(null); setAdjustQty(''); setAdjustReason(''); } }
    );
  };

  const renderItem = ({ item }: { item: StockLevel }) => {
    const status = getStatusInfo(item);
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}
        onPress={() => setAdjustTarget(item)}
        activeOpacity={0.7}
      >
        <View style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: '#14B8A6' + '15' }]}>
            <Ionicons name="layers-outline" size={20} color="#14B8A6" />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[styles.name, { color: colors.text.primary }]}>{item.productName}</Text>
            <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }}>{item.warehouseName}</Text>
          </View>
          <StatusBadge status={status.type} text={status.label} />
        </View>
        <View style={[styles.qtyRow, { borderTopColor: colors.border }]}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ color: colors.text.tertiary, fontSize: 11 }}>{t('inventory.current')}</Text>
            <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 18 }}>{item.currentQuantity}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ color: colors.text.tertiary, fontSize: 11 }}>{t('inventory.reorder')}</Text>
            <Text style={{ color: colors.warning, fontWeight: '600', fontSize: 18 }}>{item.reorderPoint}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('inventory.title')}</Text>
        <Text style={{ color: colors.text.tertiary, marginTop: 4 }}>{stockLevels.length} {t('inventory.items')}</Text>
      </View>

      {/* Quick nav buttons */}
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm }}>
        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: colors.primaryLight, borderRadius: borderRadius.md }]}
          onPress={() => navigation.navigate('PurchaseOrders')}
        >
          <Ionicons name="cart-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600', marginLeft: 6 }}>{t('inventory.purchaseOrders')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: '#14B8A6' + '15', borderRadius: borderRadius.md }]}
          onPress={() => navigation.navigate('InventoryReports')}
        >
          <Ionicons name="stats-chart-outline" size={18} color="#14B8A6" />
          <Text style={{ color: '#14B8A6', fontSize: 13, fontWeight: '600', marginLeft: 6 }}>{t('inventory.reports')}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
      </View>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState title={t('inventory.noItems')} icon={<Ionicons name="layers-outline" size={48} color={colors.text.light} />} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />

      {/* Adjust Stock Modal */}
      <Modal
        visible={!!adjustTarget}
        onClose={() => { setAdjustTarget(null); setAdjustQty(''); setAdjustReason(''); }}
        title={`${t('inventory.adjustStock')} - ${adjustTarget?.productName ?? ''}`}
        footer={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={() => { setAdjustTarget(null); setAdjustQty(''); setAdjustReason(''); }} style={{ flex: 1 }} />
            <Button title={t('common.save')} variant="primary" onPress={handleAdjust} loading={adjustMutation.isPending} style={{ flex: 1 }} />
          </View>
        }
      >
        <Text style={{ color: colors.text.tertiary, marginBottom: 4 }}>{t('inventory.currentQty')}: {adjustTarget?.currentQuantity}</Text>
        <Input
          label={t('inventory.quantity')}
          value={adjustQty}
          onChangeText={setAdjustQty}
          keyboardType="numeric"
          placeholder={t('inventory.qtyPlaceholder')}
        />
        <Input
          label={t('inventory.reason')}
          value={adjustReason}
          onChangeText={setAdjustReason}
          placeholder={t('inventory.reasonPlaceholder')}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontWeight: '700' },
  card: { borderWidth: 1, padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  name: { fontWeight: '600', fontSize: 15 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  divider: { width: 1, height: 30 },
  navBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, flex: 1, justifyContent: 'center' },
});
