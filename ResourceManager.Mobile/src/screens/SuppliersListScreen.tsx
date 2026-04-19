import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from '../hooks';
import SearchBar from '../components/SearchBar';
import EmptyState from '../components/EmptyState';
import Input from '../components/Input';
import { FABButton, ConfirmDeleteModal } from '../components';
import type { Supplier } from '../api/suppliers';

export default function SuppliersListScreen({ navigation }: any) {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { data: suppliers = [], isLoading, refetch, isRefetching } = useSuppliers();
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();

  const [formVisible, setFormVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });

  const filtered = suppliers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.phone?.includes(q);
  });

  const openCreate = () => { setEditingItem(null); setForm({ name: '', email: '', phone: '', address: '' }); setFormVisible(true); };
  const openEdit = (item: Supplier) => { setEditingItem(item); setForm({ name: item.name, email: item.email || '', phone: item.phone || '', address: item.address || '' }); setFormVisible(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert(t('common.error'), t('supplier.nameRequired')); return; }
    try {
      if (editingItem) { await updateMutation.mutateAsync({ id: editingItem.id, data: form }); }
      else { await createMutation.mutateAsync(form); }
      setFormVisible(false);
    } catch (error) { Alert.alert(t('common.error'), (error as Error).message); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteMutation.mutateAsync(deleteTarget.id); setDeleteTarget(null); }
    catch (error) { Alert.alert(t('common.error'), (error as Error).message); }
  };

  const renderItem = ({ item }: { item: Supplier }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}
      activeOpacity={0.7}
      onPress={() => openEdit(item)}
      onLongPress={() => setDeleteTarget(item)}
    >
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + '20', borderRadius: borderRadius.full }]}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[styles.name, { color: colors.text.primary }]}>{item.name}</Text>
          {item.email && <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }}>{item.email}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.light} />
      </View>
      {(item.phone || item.address) && (
        <View style={[styles.meta, { borderTopColor: colors.border }]}>
          {item.phone && (<View style={styles.metaItem}><Ionicons name="call-outline" size={14} color={colors.text.tertiary} /><Text style={{ color: colors.text.secondary, fontSize: 13, marginLeft: 4 }}>{item.phone}</Text></View>)}
          {item.address && (<View style={styles.metaItem}><Ionicons name="location-outline" size={14} color={colors.text.tertiary} /><Text style={{ color: colors.text.secondary, fontSize: 13, marginLeft: 4 }} numberOfLines={1}>{item.address}</Text></View>)}
        </View>
      )}
    </TouchableOpacity>
  );

  if (isLoading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('supplier.title')}</Text>
        <Text style={{ color: colors.text.tertiary, marginTop: 4 }}>{suppliers.length} {t('supplier.suppliers')}</Text>
      </View>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('supplier.searchPlaceholder')} />
      </View>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState title={t('supplier.noSuppliers')} icon={<Ionicons name="business-outline" size={48} color={colors.text.light} />} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
      <FABButton onPress={openCreate} />

      <Modal visible={formVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderRadius: borderRadius.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>{editingItem ? t('supplier.edit') : t('supplier.add')}</Text>
              <TouchableOpacity onPress={() => setFormVisible(false)}><Ionicons name="close" size={24} color={colors.text.secondary} /></TouchableOpacity>
            </View>
            <ScrollView>
              <Input label={t('supplier.name')} value={form.name} onChangeText={(v) => setForm(p => ({ ...p, name: v }))} placeholder={t('supplier.namePlaceholder')} />
              <Input label={t('supplier.email')} value={form.email} onChangeText={(v) => setForm(p => ({ ...p, email: v }))} placeholder={t('supplier.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" />
              <Input label={t('supplier.phone')} value={form.phone} onChangeText={(v) => setForm(p => ({ ...p, phone: v }))} placeholder={t('supplier.phonePlaceholder')} keyboardType="phone-pad" />
              <Input label={t('supplier.address')} value={form.address} onChangeText={(v) => setForm(p => ({ ...p, address: v }))} placeholder={t('supplier.addressPlaceholder')} />
            </ScrollView>
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]} onPress={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>{t('common.save')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDeleteModal visible={!!deleteTarget} title={t('supplier.deleteConfirm')} message={deleteTarget?.name || ''} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
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
  avatar: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  name: { fontWeight: '600', fontSize: 15 },
  meta: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 10, gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { maxHeight: '85%', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  saveButton: { marginTop: 16, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
