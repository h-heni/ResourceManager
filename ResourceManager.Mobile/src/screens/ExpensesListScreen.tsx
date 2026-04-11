import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from '../hooks';
import SearchBar from '../components/SearchBar';
import FilterChips from '../components/FilterChips';
import EmptyState from '../components/EmptyState';
import Input from '../components/Input';
import { FABButton, ConfirmDeleteModal, FormDatePicker, FormSelect } from '../components';
import type { Expense } from '../api/expenses';

export default function ExpensesListScreen() {
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const { data: expenses = [], isLoading, refetch, isRefetching } = useExpenses(currentYear);
  const createMutation = useCreateExpense();
  const updateMutation = useUpdateExpense();
  const deleteMutation = useDeleteExpense();

  const [formVisible, setFormVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [form, setForm] = useState({ description: '', amount: '', category: '', date: new Date(), notes: '' });

  const categories = useMemo(() => {
    const cats = new Set(expenses.map((e) => e.category));
    return ['All', ...Array.from(cats)];
  }, [expenses]);

  const filtered = expenses.filter((e) => {
    if (categoryFilter !== 'All' && e.category !== categoryFilter) return false;
    if (!search) return true;
    return e.description.toLowerCase().includes(search.toLowerCase());
  });

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const openCreate = () => { setEditingItem(null); setForm({ description: '', amount: '', category: '', date: new Date(), notes: '' }); setFormVisible(true); };
  const openEdit = (item: Expense) => { setEditingItem(item); setForm({ description: item.description, amount: item.amount.toString(), category: item.category, date: new Date(item.date), notes: (item as any).notes || '' }); setFormVisible(true); };

  const handleSave = async () => {
    if (!form.description.trim()) { Alert.alert(t('common.error'), t('expense.descriptionRequired')); return; }
    try {
      const payload = { description: form.description, amount: parseFloat(form.amount) || 0, category: form.category, date: form.date.toISOString(), notes: form.notes };
      if (editingItem) { await updateMutation.mutateAsync({ id: editingItem.id, ...payload }); }
      else { await createMutation.mutateAsync(payload); }
      setFormVisible(false);
    } catch (error) { Alert.alert(t('common.error'), (error as Error).message); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteMutation.mutateAsync(deleteTarget.id); setDeleteTarget(null); }
    catch (error) { Alert.alert(t('common.error'), (error as Error).message); }
  };

  const renderItem = ({ item }: { item: Expense }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}
      activeOpacity={0.7}
      onPress={() => openEdit(item)}
      onLongPress={() => setDeleteTarget(item)}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.error + '15' }]}>
          <Ionicons name="wallet-outline" size={20} color={colors.error} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[styles.desc, { color: colors.text.primary }]} numberOfLines={1}>{item.description}</Text>
          <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }}>{item.category} · {formatDate(item.date)}</Text>
        </View>
        <Text style={[styles.amount, { color: colors.error }]}>-{item.amount.toLocaleString()} {item.currencySymbol || 'TND'}</Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('expense.title')}</Text>
        <View style={[styles.totalCard, { backgroundColor: colors.error + '10', borderRadius: borderRadius.md }]}>
          <Text style={{ color: colors.error, fontSize: 13 }}>{t('expense.total')} ({currentYear})</Text>
          <Text style={{ color: colors.error, fontWeight: '700', fontSize: 20 }}>{total.toLocaleString()} TND</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
        <FilterChips options={categories} selected={categoryFilter} onSelect={setCategoryFilter} />
      </View>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState title={t('expense.noExpenses')} icon={<Ionicons name="wallet-outline" size={48} color={colors.text.light} />} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
      <FABButton onPress={openCreate} />

      <Modal visible={formVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderRadius: borderRadius.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>{editingItem ? t('expense.edit') : t('expense.add')}</Text>
              <TouchableOpacity onPress={() => setFormVisible(false)}><Ionicons name="close" size={24} color={colors.text.secondary} /></TouchableOpacity>
            </View>
            <ScrollView>
              <Input label={t('expense.description')} value={form.description} onChangeText={(v) => setForm(p => ({ ...p, description: v }))} placeholder={t('expense.descriptionPlaceholder')} />
              <Input label={t('expense.amount')} value={form.amount} onChangeText={(v) => setForm(p => ({ ...p, amount: v }))} placeholder="0.00" keyboardType="decimal-pad" />
              <Input label={t('expense.category')} value={form.category} onChangeText={(v) => setForm(p => ({ ...p, category: v }))} placeholder={t('expense.categoryPlaceholder')} />
              <FormDatePicker label={t('expense.date')} value={form.date} onChange={(d) => setForm(p => ({ ...p, date: d }))} />
              <Input label={t('createPage.notes')} value={form.notes} onChangeText={(v) => setForm(p => ({ ...p, notes: v }))} placeholder={t('createPage.notesPlaceholder')} multiline />
            </ScrollView>
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]} onPress={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>{t('common.save')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDeleteModal visible={!!deleteTarget} title={t('expense.deleteConfirm')} message={deleteTarget?.description || ''} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontWeight: '700' },
  totalCard: { marginTop: 12, padding: 14, alignItems: 'center' },
  card: { borderWidth: 1, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  desc: { fontWeight: '600', fontSize: 15 },
  amount: { fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { maxHeight: '85%', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  saveButton: { marginTop: 16, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
