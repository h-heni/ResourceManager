import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from '../hooks';
import SearchBar from '../components/SearchBar';
import EmptyState from '../components/EmptyState';
import Input from '../components/Input';
import { FABButton, ConfirmDeleteModal } from '../components';
import type { Client } from '../api/clients';

export default function ClientsListScreen() {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page] = useState(1);
  const { data, isLoading, refetch, isRefetching } = useClients(page, 100);
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const deleteMutation = useDeleteClient();

  const [formVisible, setFormVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', taxId: '' });

  const clients = data?.items ?? [];
  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q);
  });

  const openCreate = () => {
    setEditingClient(null);
    setForm({ name: '', email: '', phone: '', address: '', taxId: '' });
    setFormVisible(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setForm({ name: client.name, email: client.email || '', phone: client.phone || '', address: client.address || '', taxId: (client as any).taxId || '' });
    setFormVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert(t('common.error'), t('client.nameRequired')); return; }
    try {
      if (editingClient) {
        await updateMutation.mutateAsync({ id: editingClient.id, data: form });
      } else {
        await createMutation.mutateAsync(form);
      }
      setFormVisible(false);
    } catch (error) {
      Alert.alert(t('common.error'), (error as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      Alert.alert(t('common.error'), (error as Error).message);
    }
  };

  const renderItem = ({ item }: { item: Client }) => (
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
        {item.totalInvoices != null && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{item.totalInvoices}</Text>
            <Text style={{ color: colors.text.tertiary, fontSize: 11 }}>{t('client.invoices')}</Text>
          </View>
        )}
      </View>
      {(item.phone || item.address) && (
        <View style={[styles.meta, { borderTopColor: colors.border }]}>
          {item.phone && (
            <View style={styles.metaItem}>
              <Ionicons name="call-outline" size={14} color={colors.text.tertiary} />
              <Text style={{ color: colors.text.secondary, fontSize: 13, marginLeft: 4 }}>{item.phone}</Text>
            </View>
          )}
          {item.address && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
              <Text style={{ color: colors.text.secondary, fontSize: 13, marginLeft: 4 }} numberOfLines={1}>{item.address}</Text>
            </View>
          )}
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
        <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('client.title')}</Text>
        <Text style={{ color: colors.text.tertiary, marginTop: 4 }}>{data?.totalCount ?? 0} {t('client.clients')}</Text>
      </View>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('client.searchPlaceholder')} />
      </View>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState title={t('client.noClients')} icon={<Ionicons name="people-outline" size={48} color={colors.text.light} />} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
      <FABButton onPress={openCreate} />

      {/* Create/Edit Modal */}
      <Modal visible={formVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderRadius: borderRadius.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>{editingClient ? t('client.edit') : t('client.add')}</Text>
              <TouchableOpacity onPress={() => setFormVisible(false)}><Ionicons name="close" size={24} color={colors.text.secondary} /></TouchableOpacity>
            </View>
            <ScrollView>
              <Input label={t('client.name')} value={form.name} onChangeText={(v) => setForm(p => ({ ...p, name: v }))} placeholder={t('client.namePlaceholder')} />
              <Input label={t('client.email')} value={form.email} onChangeText={(v) => setForm(p => ({ ...p, email: v }))} placeholder={t('client.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" />
              <Input label={t('client.phone')} value={form.phone} onChangeText={(v) => setForm(p => ({ ...p, phone: v }))} placeholder={t('client.phonePlaceholder')} keyboardType="phone-pad" />
              <Input label={t('client.address')} value={form.address} onChangeText={(v) => setForm(p => ({ ...p, address: v }))} placeholder={t('client.addressPlaceholder')} />
              <Input label={t('client.taxId')} value={form.taxId} onChangeText={(v) => setForm(p => ({ ...p, taxId: v }))} placeholder={t('client.taxIdPlaceholder')} />
            </ScrollView>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
              onPress={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>{t('common.save')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDeleteModal
        visible={!!deleteTarget}
        title={t('client.deleteConfirm')}
        message={deleteTarget?.name || ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
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
