import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Trash2, Shield, Mail, User } from 'lucide-react';
import { useUsers, useDeleteUser } from '../hooks/useUsers';
import { useAuth } from '../context/AuthContext';
import { logger } from '../lib/logger';
import { useNotify } from '../hooks/useNotify';
import { getErrorMessage } from '../utils/errorUtils';

interface UserDto {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    company?: string;
    companyId?: number;
}

const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
        case 'superadmin':
            return 'bg-purple-100 text-purple-700';
        case 'manager':
            return 'bg-blue-100 text-blue-700';
        case 'employee':
            return 'bg-green-100 text-green-700';
        default:
            return 'bg-gray-100 text-gray-700';
    }
};

export default function UsersPage() {
    const { t } = useTranslation();
    const { notify, NotifyBanner } = useNotify();
    const { user, isSuperAdmin, isManager } = useAuth();
    const canManageUsers = isSuperAdmin || isManager;

    // React Query
    const { data: users, isLoading: loading } = useUsers();
    const deleteUserMutation = useDeleteUser();

    const handleDelete = async (id: string) => {
        if (!canManageUsers) {
            notify('warning', t('common.managerOnly'));
            return;
        }
        if (!confirm(t('users.confirmDelete', 'Are you sure you want to delete this user?'))) return;
        try {
            await deleteUserMutation.mutateAsync(id);
            notify('success', t('users.deleteSuccess', 'User deleted successfully'));
        } catch (error) {
            logger.error('Error deleting user', error);
            notify('error', getErrorMessage(error, t('users.deleteFailed', 'Failed to delete user')));
        }
    };

    return (
        <div className="space-y-6">
            <NotifyBanner />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">👥 {t('nav.users', 'Users')}</h1>
                    <p className="text-gray-500 mt-1">{t('users.pageDescription', 'Manage user accounts and permissions')}</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <Users size={24} className="text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('users.totalUsers', 'Total Users')}</p>
                            <p className="text-2xl font-bold text-gray-900">{(users || []).length}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-100 rounded-lg">
                            <Shield size={24} className="text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('users.managers', 'Managers')}</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {(users || []).filter((u: UserDto) => u.role === 'Manager').length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-100 rounded-lg">
                            <User size={24} className="text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('users.employees', 'Employees')}</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {(users || []).filter((u: UserDto) => u.role === 'Employee').length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="text-center py-20 text-gray-500">{t('users.loading', 'Loading...')}</div>
            ) : (
                <div className="rm-table-card">
                    <div className="overflow-x-auto">
                        <table className="rm-table">
                            <thead>
                                <tr>
                                    <th>{t('users.name', 'Name')}</th>
                                    <th>{t('users.email', 'Email')}</th>
                                    <th>{t('users.role', 'Role')}</th>
                                    <th>{t('users.company', 'Company')}</th>
                                    {canManageUsers && <th className="text-right">{t('common.actions', 'Actions')}</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {(users || []).map((userItem: UserDto) => (
                                    <tr key={userItem.id}>
                                        <td className="font-medium">
                                            {userItem.firstName} {userItem.lastName}
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <Mail size={14} className="text-gray-400" />
                                                <span>{userItem.email}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(userItem.role)}`}>
                                                {userItem.role}
                                            </span>
                                        </td>
                                        <td className="text-gray-600">{userItem.company || '-'}</td>
                                        {canManageUsers && (
                                            <td className="text-right">
                                                {userItem.id !== user?.email && (
                                                    <button
                                                        onClick={() => handleDelete(userItem.id)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title={t('common.delete', 'Delete')}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {(users || []).length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <Users size={48} className="mx-auto text-gray-300 mb-4" />
                                <p className="font-medium">{t('users.noData', 'No users found')}</p>
                                <p className="text-sm text-gray-400 mt-1">{t('users.noDataDescription', 'Add users to get started')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
