import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { useUsers, useInvitations, useInviteUser, useUpdateUserRole, useDeleteUser } from '../hooks/useUsers';
import type { UserInfo, Invitation, InviteUserRequest } from '../api/users';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import { FABButton, FormSelect, ConfirmDeleteModal } from '../components';

type Tab = 'users' | 'invitations';

export default function UsersScreen() {
  const { colors, spacing, borderRadius, typography, shadows } = useAppTheme();
  const { t } = useTranslation();

  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useUsers();
  const { data: invitations = [], isLoading: invLoading, refetch: refetchInv } = useInvitations();
  const inviteMutation = useInviteUser();
  const updateRoleMutation = useUpdateUserRole();
  const deleteMutation = useDeleteUser();

  const [tab, setTab] = useState<Tab>('users');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteUserRequest>({ email: '', role: 'Employee' });
  const [deleteTarget, setDeleteTarget] = useState<UserInfo | null>(null);
  const [roleTarget, setRoleTarget] = useState<UserInfo | null>(null);
  const [selectedRole, setSelectedRole] = useState('');

  const roleOptions = [
    { label: t('users.roleEmployee'), value: 'Employee' },
    { label: t('users.roleManager'), value: 'Manager' },
    { label: t('users.roleAdmin'), value: 'Admin' },
  ];

  const handleInvite = () => {
    if (!inviteForm.email) return;
    inviteMutation.mutate(inviteForm, {
      onSuccess: () => {
        setShowInvite(false);
        setInviteForm({ email: '', role: 'Employee' });
        Alert.alert(t('common.success'), t('users.inviteSent'));
      },
      onError: () => Alert.alert(t('common.error'), t('users.inviteError')),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => { setDeleteTarget(null); },
      onError: () => Alert.alert(t('common.error'), t('users.deleteError')),
    });
  };

  const handleRoleChange = () => {
    if (!roleTarget || !selectedRole) return;
    updateRoleMutation.mutate({ id: roleTarget.id, role: selectedRole }, {
      onSuccess: () => {
        setRoleTarget(null);
        Alert.alert(t('common.success'), t('users.roleUpdated'));
      },
      onError: () => Alert.alert(t('common.error'), t('users.roleError')),
    });
  };

  const refreshing = usersLoading || invLoading;

  const renderUser = ({ item }: { item: UserInfo }) => (
    <TouchableOpacity
      onLongPress={() => setDeleteTarget(item)}
      activeOpacity={0.85}
    >
      <Card style={[styles.itemCard, { margin: spacing.sm, marginHorizontal: spacing.md }]} padding="md">
        <View style={styles.row}>
          <View style={[styles.userAvatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>
              {item.firstName?.[0]?.toUpperCase() ?? ''}{item.lastName?.[0]?.toUpperCase() ?? ''}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text.primary, fontWeight: '600', fontSize: 15 }}>
              {item.firstName} {item.lastName}
            </Text>
            <Text style={{ color: colors.text.tertiary, fontSize: 13, marginTop: 2 }}>{item.email}</Text>
          </View>
          <TouchableOpacity
            style={[styles.roleBadge, { backgroundColor: colors.primaryLight }]}
            onPress={() => { setRoleTarget(item); setSelectedRole(item.roles?.[0] ?? 'Employee'); }}
          >
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{item.roles?.[0] ?? 'Employee'}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderInvitation = ({ item }: { item: Invitation }) => (
    <Card style={[styles.itemCard, { margin: spacing.sm, marginHorizontal: spacing.md }]} padding="md">
      <View style={styles.row}>
        <View style={[styles.userAvatar, { backgroundColor: colors.warning + '20' }]}>
          <Ionicons name="mail-outline" size={20} color={colors.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{item.email}</Text>
          <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }}>
            {item.role} · {item.status}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.h1 }]}>{t('users.title')}</Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.divider }]}>
        {(['users', 'invitations'] as Tab[]).map((t2) => (
          <TouchableOpacity
            key={t2}
            style={[styles.tab, tab === t2 && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t2)}
          >
            <Text style={{ color: tab === t2 ? colors.primary : colors.text.tertiary, fontWeight: tab === t2 ? '600' : '400' }}>
              {t2 === 'users' ? t('users.activeUsers') : t('users.invitations')} ({t2 === 'users' ? users.length : invitations.length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'users' ? (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderUser}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refetchUsers(); refetchInv(); }} colors={[colors.primary]} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.text.tertiary, marginTop: 40 }}>{t('users.noUsers')}</Text>}
        />
      ) : (
        <FlatList
          data={invitations}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderInvitation}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refetchUsers(); refetchInv(); }} colors={[colors.primary]} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.text.tertiary, marginTop: 40 }}>{t('users.noInvitations')}</Text>}
        />
      )}

      <FABButton icon="person-add" onPress={() => setShowInvite(true)} />

      {/* Invite Modal */}
      <Modal
        visible={showInvite}
        onClose={() => setShowInvite(false)}
        title={t('users.inviteUser')}
        footer={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={() => setShowInvite(false)} style={{ flex: 1 }} />
            <Button title={t('users.sendInvite')} variant="primary" onPress={handleInvite} loading={inviteMutation.isPending} style={{ flex: 1 }} />
          </View>
        }
      >
        <Input label={t('users.email')} value={inviteForm.email} onChangeText={(v) => setInviteForm(p => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" />
        <FormSelect label={t('users.role')} value={inviteForm.role} options={roleOptions} onSelect={(v) => setInviteForm(p => ({ ...p, role: String(v) }))} />
      </Modal>

      {/* Change Role Modal */}
      <Modal
        visible={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        title={t('users.changeRole')}
        footer={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={() => setRoleTarget(null)} style={{ flex: 1 }} />
            <Button title={t('common.save')} variant="primary" onPress={handleRoleChange} loading={updateRoleMutation.isPending} style={{ flex: 1 }} />
          </View>
        }
      >
        <Text style={{ color: colors.text.secondary, marginBottom: 12 }}>{roleTarget?.firstName} {roleTarget?.lastName}</Text>
        <FormSelect label={t('users.role')} value={selectedRole} options={roleOptions} onSelect={(v) => setSelectedRole(String(v))} />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDeleteModal
        visible={!!deleteTarget}
        title={t('users.deleteUser')}
        message={`${t('users.deleteConfirm')} ${deleteTarget?.firstName} ${deleteTarget?.lastName}?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontWeight: '700' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  itemCard: {},
  row: { flexDirection: 'row', alignItems: 'center' },
  userAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
});
