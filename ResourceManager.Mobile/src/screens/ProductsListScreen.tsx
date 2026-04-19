import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { useProductServices, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks';
import SearchBar from '../components/SearchBar';
import EmptyState from '../components/EmptyState';
import Input from '../components/Input';
import { FABButton, ConfirmDeleteModal, FormSelect } from '../components';
import type { ProductService } from '../api/products';

export default function ProductsListScreen() {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { data: productsData, isLoading, refetch, isRefetching } = useProductServices();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const products = Array.isArray(productsData) ? productsData : (productsData?.items ?? []);

  const [formVisible, setFormVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductService | null>(null);
  const [editingItem, setEditingItem] = useState<ProductService | null>(null);
  const [form, setForm] = useState({ name: '', description: '', defaultUnitPrice: '', type: 'Product', vatApplicable: true });

  const filtered = products.filter((p) => {
    if (!search) return true;
    return p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
  });

  const openCreate = () => { setEditingItem(null); setForm({ name: '', description: '', defaultUnitPrice: '', type: 'Product', vatApplicable: true }); setFormVisible(true); };
  const openEdit = (item: ProductService) => { setEditingItem(item); setForm({ name: item.name, description: item.description || '', defaultUnitPrice: item.price.toString(), type: item.type, vatApplicable: (item as any).vatApplicable ?? true }); setFormVisible(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert(t('common.error'), t('product.nameRequired')); return; }
    try {
      const payload = { name: form.name, description: form.description, price: parseFloat(form.defaultUnitPrice) || 0, type: form.type, vatApplicable: form.vatApplicable };
      if (editingItem) { await updateMutation.mutateAsync({ id: editingItem.id, data: payload }); }
      else { await createMutation.mutateAsync(payload); }
      setFormVisible(false);
    } catch (error) { Alert.alert(t('common.error'), (error as Error).message); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteMutation.mutateAsync(deleteTarget.id); setDeleteTarget(null); }
    catch (error) { Alert.alert(t('common.error'), (error as Error).message); }
  };

  const renderItem = ({ item }: { item: ProductService }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}
      activeOpacity={0.7}
      onPress={() => openEdit(item)}
      onLongPress={() => setDeleteTarget(item)}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: '#EC4899' + '15' }]}>
          <Ionicons name={item.type === 'Service' ? 'construct-outline' : 'cube-outline'} size={20} color="#EC4899" />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[styles.name, { color: colors.text.primary }]}>{item.name}</Text>
          <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }}>{item.type}</Text>
        </View>
        <Text style={[styles.price, { color: colors.primary }]}>{item.price.toLocaleString()} {item.currency || 'TND'}</Text>
      </View>
      {item.description && (
        <Text style={{ color: colors.text.secondary, fontSize: 13, marginTop: 8 }} numberOfLines={2}>{item.description}</Text>
      )}
    </TouchableOpacity>
  );

  if (isLoading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('product.title')}</Text>
        <Text style={{ color: colors.text.tertiary, marginTop: 4 }}>{products.length} {t('product.products')}</Text>
      </View>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
      </View>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState title={t('product.noProducts')} icon={<Ionicons name="cube-outline" size={48} color={colors.text.light} />} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
      <FABButton onPress={openCreate} />

      <Modal visible={formVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderRadius: borderRadius.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>{editingItem ? t('product.edit') : t('product.add')}</Text>
              <TouchableOpacity onPress={() => setFormVisible(false)}><Ionicons name="close" size={24} color={colors.text.secondary} /></TouchableOpacity>
            </View>
            <ScrollView>
              <Input label={t('product.name')} value={form.name} onChangeText={(v) => setForm(p => ({ ...p, name: v }))} placeholder={t('product.namePlaceholder')} />
              <Input label={t('product.description')} value={form.description} onChangeText={(v) => setForm(p => ({ ...p, description: v }))} placeholder={t('product.descriptionPlaceholder')} multiline />
              <Input label={t('product.price')} value={form.defaultUnitPrice} onChangeText={(v) => setForm(p => ({ ...p, defaultUnitPrice: v }))} placeholder="0.00" keyboardType="decimal-pad" />
              <FormSelect
                label={t('product.type')}
                options={[{ label: 'Product', value: 'Product' }, { label: 'Service', value: 'Service' }]}
                value={form.type}
                onSelect={(v) => setForm(p => ({ ...p, type: String(v) }))}
              />
              <View style={styles.switchRow}>
                <Text style={{ color: colors.text.primary, flex: 1 }}>{t('product.vatApplicable')}</Text>
                <Switch value={form.vatApplicable} onValueChange={(v) => setForm(p => ({ ...p, vatApplicable: v }))} trackColor={{ true: colors.primary }} />
              </View>
            </ScrollView>
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]} onPress={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>{t('common.save')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDeleteModal visible={!!deleteTarget} title={t('product.deleteConfirm')} message={deleteTarget?.name || ''} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontWeight: '700' },
  card: { borderWidth: 1, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  name: { fontWeight: '600', fontSize: 15 },
  price: { fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { maxHeight: '85%', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  saveButton: { marginTop: 16, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
