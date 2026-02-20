import { useEffect, useState } from 'react';
import api from '../services/api';
import { getErrorMessage, getErrorStatus, getAxiosResponseData } from '../utils/errorUtils';
import { useAuth } from '../context/AuthContext';
import { Plus, Users, AlertCircle, Trash2, KeyRound, X, Building2, Settings, Mail, CheckCircle, UserPlus, Shield } from 'lucide-react';
import { logger } from '../lib/logger';
import { useTranslation } from 'react-i18next';
import { useNotify } from '../hooks/useNotify';

interface UserDto {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    company?: string;
    companyId?: number;
    employeeLimit?: number;
    subscriptionExpiryDate?: string;
    accountStatus?: string;
}

interface CompanyCapacity {
    id: number;
    name: string;
    employeeLimit: number;
    employeeCount: number;
    subscriptionExpiryDate?: string;
    accountStatus: string;
}

export default function UsersPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { notify, NotifyBanner } = useNotify();
    const [users, setUsers] = useState<UserDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [showTenantModal, setShowTenantModal] = useState(false);
    const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [employeeLimit, setEmployeeLimit] = useState(0);
    const [employeeCount, setEmployeeCount] = useState(0);
    const [, setCompanies] = useState<CompanyCapacity[]>([]);

    const isSuperAdmin = user?.roles?.includes('SuperAdmin');
    const isManager = user?.roles?.includes('Manager') || user?.roles?.includes('FreeUser');
    const canManageUsers = isSuperAdmin || isManager;

    // Form States
    const [newEmployee, setNewEmployee] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: ''
    });

    const [newTenant, setNewTenant] = useState({
        email: '',
        employeeCapacity: 0,
        preferredLanguage: 'fr'
    });
    const [invitationSent, setInvitationSent] = useState(false);
    const [tenantMode, setTenantMode] = useState<'invite' | 'direct'>('invite');

    const [newDirectTenant, setNewDirectTenant] = useState({
        companyName: '',
        address: '',
        taxId: '',
        phone: '',
        email: '',
        userEmail: '',
        userPassword: '',
        userFirstName: '',
        userLastName: '',
        defaultCurrency: 'TND',
        defaultLanguage: 'fr',
        employeeLimit: 0
    });
    const [directTenantCreated, setDirectTenantCreated] = useState(false);

    const [newPassword, setNewPassword] = useState('');

    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        fetchUsers();
    }, []);
    /* eslint-enable react-hooks/exhaustive-deps */

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/Users');
            const data = res.data;
            setUsers(Array.isArray(data) ? data : (data.data || []));
            // Capacity data from API
            if (data.employeeLimit !== undefined) setEmployeeLimit(data.employeeLimit);
            if (data.employeeCount !== undefined) setEmployeeCount(data.employeeCount);
            if (data.companies) setCompanies(data.companies);
        } catch (err: unknown) {
            logger.error("Failed to fetch users", err);
            const status = getErrorStatus(err);
            if (status === 403) {
                setError(t('users.messages.forbidden'));
            } else if (status === 401) {
                setError(t('users.messages.authRequired'));
            } else {
                setError(t('users.messages.loadFailed'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            await api.post('/Auth/register-manual', newEmployee);
            setShowEmployeeModal(false);
            setNewEmployee({ email: '', password: '', firstName: '', lastName: '' });
            fetchUsers();
            notify('success', t('users.messages.employeeCreated'));
        } catch (err: unknown) {
            logger.error("Failed to create employee", err);
            const responseData = getAxiosResponseData(err);
            const errorMsg = responseData?.errors
                ? Object.values(responseData.errors as Record<string, string[]>).flat().join(', ')
                : getErrorMessage(err, t('users.messages.employeeCreateFailed'));
            notify('error', errorMsg);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        setInvitationSent(false);
        try {
            await api.post('/superadmin/invite-manager', {
                email: newTenant.email,
                employeeCapacity: newTenant.employeeCapacity,
                preferredLanguage: newTenant.preferredLanguage
            });
            setInvitationSent(true);
        } catch (err: unknown) {
            logger.error("Failed to send invitation", err);
            const errorMsg = getErrorMessage(err, t('users.messages.tenantCreateFailed'));
            notify('error', errorMsg);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateDirectTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        setDirectTenantCreated(false);
        try {
            await api.post('/Auth/create-tenant', newDirectTenant);
            setDirectTenantCreated(true);
            fetchUsers();
        } catch (err: unknown) {
            logger.error("Failed to create tenant directly", err);
            const responseData = getAxiosResponseData(err);
            const errorMsg = responseData?.errors
                ? Object.values(responseData.errors as Record<string, string[]>).flat().join(', ')
                : getErrorMessage(err, t('users.messages.tenantCreateFailed'));
            notify('error', errorMsg);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteUser = async (targetUser: UserDto) => {
        if (targetUser.email === user?.email) {
            notify('warning', t('users.messages.cannotDeleteSelf'));
            return;
        }

        const isTargetManager = targetUser.role === 'Manager' || targetUser.role === 'FreeUser';
        const confirmMsg = isSuperAdmin && isTargetManager
            ? t('users.messages.confirmDeleteManager', { name: `${targetUser.firstName} ${targetUser.lastName}`.trim(), email: targetUser.email })
            : t('users.messages.confirmDeleteUser', { name: `${targetUser.firstName} ${targetUser.lastName}`.trim(), email: targetUser.email });
        if (!confirm(confirmMsg)) return;

        setActionLoading(true);
        try {
            await api.delete(`/Users/${targetUser.id}`);
            fetchUsers();
            notify('success', t('users.messages.deleted'));
        } catch (err: unknown) {
            logger.error("Failed to delete user", err);
            const errorMsg = getErrorMessage(err, t('users.messages.deleteFailed'));
            notify('error', errorMsg);
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        if (newPassword.length < 6) {
            notify('warning', t('users.messages.passwordMin'));
            return;
        }

        setActionLoading(true);
        try {
            await api.post(`/Users/${selectedUser.id}/reset-password`, { newPassword });
            setShowResetPasswordModal(false);
            setSelectedUser(null);
            setNewPassword('');
            notify('success', t('users.messages.passwordResetSuccess'));
        } catch (err: unknown) {
            logger.error("Failed to reset password", err);
            const errorMsg = getErrorMessage(err, t('users.messages.passwordResetFailed'));
            notify('error', errorMsg);
        } finally {
            setActionLoading(false);
        }
    };

    const openResetPasswordModal = (targetUser: UserDto) => {
        setSelectedUser(targetUser);
        setNewPassword('');
        setShowResetPasswordModal(true);
    };

    const canDeleteUser = (targetUser: UserDto) => {
        if (targetUser.email === user?.email) return false;
        if (isSuperAdmin && targetUser.role !== 'SuperAdmin') return true;
        if (isManager && targetUser.role === 'Employee' && !isSuperAdmin) return true;
        return false;
    };

    const canResetPassword = (targetUser: UserDto) => {
        if (isSuperAdmin) return true;
        if (isManager && targetUser.role === 'Employee') return true;
        return false;
    };

    const canResetSettings = (targetUser: UserDto) => {
        // Only SuperAdmin can reset settings, and only for Managers/FreeUsers
        return isSuperAdmin && (targetUser.role === 'Manager' || targetUser.role === 'FreeUser');
    };

    const handleResetSettings = async (targetUser: UserDto) => {
        if (!confirm(t('users.messages.confirmResetSettings', { name: `${targetUser.firstName} ${targetUser.lastName || targetUser.email}`.trim() }))) return;
        setActionLoading(true);
        try {
            await api.post(`/Users/${targetUser.id}/reset-settings`);
            notify('success', t('users.messages.resetSettingsSuccess'));
        } catch (err: unknown) {
            notify('error', getErrorMessage(err, t('users.messages.resetSettingsFailed')));
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">{t('users.messages.loading')}</div>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle size={48} className="text-red-400 mb-4" />
            <p className="text-red-600 font-medium">{error}</p>
            <button 
                onClick={fetchUsers}
                className="mt-4 px-4 py-2 bg-[#065F46] text-white rounded-xl hover:bg-[#047857]"
            >
                {t('users.messages.retry')}
            </button>
        </div>
    );

    if (!canManageUsers) return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <Users size={48} className="text-gray-400 mb-4" />
            <p className="text-gray-600 font-medium">{t('users.messages.managerOnly')}</p>
        </div>
    );

    return (
        <div className="animate-fade-in">
            <NotifyBanner />
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('users.title')}</h1>
                    <p className="text-gray-500 mt-1">
                        {isSuperAdmin 
                            ? t('users.messages.manageSuperAdmin')
                            : t('users.messages.manageManager')}
                    </p>
                    {/* Capacity counter for Manager view */}
                    {isManager && !isSuperAdmin && employeeLimit > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                            <Shield size={16} className={employeeCount >= employeeLimit + 1 ? 'text-red-500' : 'text-emerald-600'} />
                            <span className={`text-sm font-medium ${employeeCount >= employeeLimit + 1 ? 'text-red-600' : 'text-gray-600'}`}>
                                {t('users.capacity.label')}: {employeeCount} / {employeeLimit + 1}
                            </span>
                            {employeeCount >= employeeLimit + 1 && (
                                <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{t('users.capacity.full')}</span>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                    {isSuperAdmin && (
                        <button
                            onClick={() => setShowTenantModal(true)}
                            className="flex items-center space-x-2 bg-[#065F46] text-white px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all"
                        >
                            <Building2 size={20} />
                            <span>{t('users.actions.addTenant')}</span>
                        </button>
                    )}
                    <button
                        onClick={() => setShowEmployeeModal(true)}
                        className="flex items-center space-x-2 bg-[#065F46] text-white px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all"
                    >
                        <Plus size={20} />
                        <span>{t('users.actions.addEmployee')}</span>
                    </button>
                </div>
            </div>

            <div className="rm-table-card overflow-x-auto">
                <table className="rm-table min-w-[700px]">
                    <colgroup>
                        <col style={{ width: '35%' }} />{/* User */}
                        {isSuperAdmin && <col style={{ width: '15%' }} />}{/* Company */}
                        <col style={{ width: '18%' }} />{/* Role */}
                        <col style={{ width: '15%' }} />{/* Status */}
                        <col style={{ width: isSuperAdmin ? '17%' : '32%' }} />{/* Actions */}
                    </colgroup>
                    <thead>
                        <tr>
                            <th>{t('users.table.user')}</th>
                            {isSuperAdmin && (
                                <th>{t('users.table.company')}</th>
                            )}
                            <th>{t('users.table.role')}</th>
                            <th>{t('users.table.status')}</th>
                            <th className="rm-th-actions">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id}>
                                <td className="rm-cell-text">
                                    <div className="flex items-center">
                                        <div className="h-10 w-10 rounded-full bg-[#065F46]/10 flex items-center justify-center text-[#065F46] font-bold">
                                            {u.firstName?.[0] || u.email[0].toUpperCase()}
                                        </div>
                                        <div className="ms-4">
                                            <div className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</div>
                                            <div className="text-sm text-gray-500">{u.email}</div>
                                        </div>
                                    </div>
                                </td>
                                {isSuperAdmin && (
                                    <td className="rm-cell-text">
                                        <span className="text-sm text-gray-700">{u.company || t('users.table.notAvailable')}</span>
                                    </td>
                                )}
                                <td className="rm-cell-text">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                        u.role === 'SuperAdmin' ? 'bg-red-50 text-red-600' :
                                        u.role === 'Manager' || u.role === 'FreeUser' ? 'bg-[#065F46]/5 text-[#065F46]' :
                                        'bg-blue-50 text-blue-600'
                                    }`}>
                                        {u.role || t('users.roles.Employee')}
                                    </span>
                                </td>
                                <td className="rm-cell-text">
                                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600">
                                        {t('users.status.active')}
                                    </span>
                                </td>
                                <td className="rm-cell-actions">
                                    <div className="flex items-center justify-end space-x-2">
                                        {canResetPassword(u) && (
                                            <button
                                                onClick={() => openResetPasswordModal(u)}
                                                className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                title={t('users.actions.resetPassword')}
                                            >
                                                <KeyRound size={18} />
                                            </button>
                                        )}
                                        {canResetSettings(u) && (
                                            <button
                                                onClick={() => handleResetSettings(u)}
                                                disabled={actionLoading}
                                                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                                                title={t('users.actions.resetSettings')}
                                            >
                                                <Settings size={18} />
                                            </button>
                                        )}
                                        {canDeleteUser(u) && (
                                            <button
                                                onClick={() => handleDeleteUser(u)}
                                                disabled={actionLoading}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                title={t('users.actions.deleteUser')}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={isSuperAdmin ? 5 : 4} className="px-4 py-10 text-center text-gray-500">
                                    {t('users.messages.empty')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Employee Modal */}
            {showEmployeeModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-md p-6 animate-scale-up max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">{t('users.actions.addEmployee')}</h2>
                            <button onClick={() => setShowEmployeeModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateEmployee} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.firstName')}</label>
                                    <input
                                        className="fancy-input w-full"
                                        value={newEmployee.firstName}
                                        onChange={e => setNewEmployee({ ...newEmployee, firstName: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.lastName')}</label>
                                    <input
                                        className="fancy-input w-full"
                                        value={newEmployee.lastName}
                                        onChange={e => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.email')}</label>
                                <input
                                    type="email"
                                    className="fancy-input w-full"
                                    value={newEmployee.email}
                                    onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
                                <input
                                    type="password"
                                    className="fancy-input w-full"
                                    value={newEmployee.password}
                                    onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })}
                                    required
                                    minLength={6}
                                />
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowEmployeeModal(false)}
                                    className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-xl bg-[#065F46] text-white hover:bg-[#047857] shadow-md disabled:opacity-50"
                                >
                                    {actionLoading ? t('users.actions.creating') : t('users.actions.createEmployee')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Tenant Modal (SuperAdmin only) */}
            {showTenantModal && isSuperAdmin && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 animate-scale-up max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {tenantMode === 'invite' ? <Mail className="text-emerald-600" size={24} /> : <UserPlus className="text-blue-600" size={24} />}
                                {t('users.actions.addTenant')}
                            </h2>
                            <button onClick={() => { setShowTenantModal(false); setInvitationSent(false); setDirectTenantCreated(false); setNewTenant({ email: '', employeeCapacity: 0, preferredLanguage: 'fr' }); setTenantMode('invite'); setNewDirectTenant({ companyName: '', address: '', taxId: '', phone: '', email: '', userEmail: '', userPassword: '', userFirstName: '', userLastName: '', defaultCurrency: 'TND', defaultLanguage: 'fr', employeeLimit: 0 }); }} className="p-2 hover:bg-gray-100 rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Tab Toggle */}
                        {!invitationSent && !directTenantCreated && (
                            <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
                                <button
                                    type="button"
                                    onClick={() => setTenantMode('invite')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${tenantMode === 'invite' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Mail size={16} />
                                    {t('users.actions.sendInvitation')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTenantMode('direct')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${tenantMode === 'direct' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <UserPlus size={16} />
                                    {t('users.actions.createDirectly')}
                                </button>
                            </div>
                        )}

                        {/* ─── INVITE MODE ─── */}
                        {tenantMode === 'invite' && (
                            <>
                                {invitationSent ? (
                                    <div className="text-center py-8">
                                        <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                                            <CheckCircle className="text-emerald-600" size={32} />
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                            {t('users.messages.invitationSent')}
                                        </h3>
                                        <p className="text-sm text-gray-500 mb-6">
                                            {t('users.messages.invitationSentDesc')}
                                        </p>
                                        <button
                                            onClick={() => { setShowTenantModal(false); setInvitationSent(false); setNewTenant({ email: '', employeeCapacity: 0, preferredLanguage: 'fr' }); setTenantMode('invite'); }}
                                            className="px-6 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
                                        >
                                            {t('common.close')}
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-sm text-gray-500 mb-6">
                                            {t('users.messages.inviteDesc')}
                                        </p>
                                        <form onSubmit={handleCreateTenant} className="space-y-6">
                                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('users.fields.emailRequired')}</label>
                                                <input
                                                    type="email"
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                                    value={newTenant.email}
                                                    onChange={e => setNewTenant({ ...newTenant, email: e.target.value })}
                                                    placeholder={t('users.fields.emailPlaceholder')}
                                                    required
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.employeeCapacity')}</label>
                                                    <input
                                                        type="number"
                                                        className="fancy-input w-full"
                                                        value={newTenant.employeeCapacity}
                                                        onChange={e => setNewTenant({ ...newTenant, employeeCapacity: parseInt(e.target.value) || 0 })}
                                                        min={0}
                                                        placeholder={t('users.fields.employeeCapacityPlaceholder')}
                                                    />
                                                    <p className="text-xs text-gray-400 mt-1">{t('users.fields.employeeCapacityHint')}</p>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.preferredLanguage')}</label>
                                                    <select
                                                        className="fancy-input w-full"
                                                        value={newTenant.preferredLanguage}
                                                        onChange={e => setNewTenant({ ...newTenant, preferredLanguage: e.target.value })}
                                                    >
                                                        <option value="fr">Français</option>
                                                        <option value="en">English</option>
                                                        <option value="ar">العربية</option>
                                                        <option value="de">Deutsch</option>
                                                    </select>
                                                    <p className="text-xs text-gray-400 mt-1">{t('users.fields.preferredLanguageHint')}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-end space-x-3">
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowTenantModal(false); setNewTenant({ email: '', employeeCapacity: 0, preferredLanguage: 'fr' }); setTenantMode('invite'); }}
                                                    className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100"
                                                >
                                                    {t('common.cancel')}
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={actionLoading}
                                                    className="px-6 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-md disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    <Mail size={16} />
                                                    {actionLoading ? t('users.actions.sending') : t('users.actions.sendInvitation')}
                                                </button>
                                            </div>
                                        </form>
                                    </>
                                )}
                            </>
                        )}

                        {/* ─── DIRECT MODE ─── */}
                        {tenantMode === 'direct' && (
                            <>
                                {directTenantCreated ? (
                                    <div className="text-center py-8">
                                        <div className="size-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                                            <CheckCircle className="text-blue-600" size={32} />
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                            {t('users.messages.directTenantCreated')}
                                        </h3>
                                        <p className="text-sm text-gray-500 mb-6">
                                            {t('users.messages.directTenantCreatedDesc')}
                                        </p>
                                        <button
                                            onClick={() => { setShowTenantModal(false); setDirectTenantCreated(false); setTenantMode('invite'); setNewDirectTenant({ companyName: '', address: '', taxId: '', phone: '', email: '', userEmail: '', userPassword: '', userFirstName: '', userLastName: '', defaultCurrency: 'TND', defaultLanguage: 'fr', employeeLimit: 0 }); }}
                                            className="px-6 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                                        >
                                            {t('common.close')}
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-sm text-gray-500 mb-6">
                                            {t('users.messages.directDesc')}
                                        </p>
                                        <form onSubmit={handleCreateDirectTenant} className="space-y-6">
                                            {/* Manager Account Section */}
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">{t('users.sections.managerAccount')}</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.firstNameRequired')}</label>
                                                        <input
                                                            className="fancy-input w-full"
                                                            value={newDirectTenant.userFirstName}
                                                            onChange={e => setNewDirectTenant({ ...newDirectTenant, userFirstName: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.lastNameRequired')}</label>
                                                        <input
                                                            className="fancy-input w-full"
                                                            value={newDirectTenant.userLastName}
                                                            onChange={e => setNewDirectTenant({ ...newDirectTenant, userLastName: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.emailRequired')}</label>
                                                    <input
                                                        type="email"
                                                        className="fancy-input w-full"
                                                        value={newDirectTenant.userEmail}
                                                        onChange={e => setNewDirectTenant({ ...newDirectTenant, userEmail: e.target.value })}
                                                        placeholder={t('users.fields.emailPlaceholder')}
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.passwordRequired')}</label>
                                                    <input
                                                        type="password"
                                                        className="fancy-input w-full"
                                                        value={newDirectTenant.userPassword}
                                                        onChange={e => setNewDirectTenant({ ...newDirectTenant, userPassword: e.target.value })}
                                                        required
                                                        minLength={6}
                                                    />
                                                </div>
                                            </div>

                                            {/* Company Info Section */}
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">{t('users.sections.companyInfo')}</h3>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.companyNameRequired')}</label>
                                                    <input
                                                        className="fancy-input w-full"
                                                        value={newDirectTenant.companyName}
                                                        onChange={e => setNewDirectTenant({ ...newDirectTenant, companyName: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.addressRequired')}</label>
                                                        <input
                                                            className="fancy-input w-full"
                                                            value={newDirectTenant.address}
                                                            onChange={e => setNewDirectTenant({ ...newDirectTenant, address: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.fiscalIdRequired')}</label>
                                                        <input
                                                            className="fancy-input w-full"
                                                            value={newDirectTenant.taxId}
                                                            onChange={e => setNewDirectTenant({ ...newDirectTenant, taxId: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.phone')}</label>
                                                        <input
                                                            type="tel"
                                                            className="fancy-input w-full"
                                                            value={newDirectTenant.phone}
                                                            onChange={e => setNewDirectTenant({ ...newDirectTenant, phone: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.companyEmail')}</label>
                                                        <input
                                                            type="email"
                                                            className="fancy-input w-full"
                                                            value={newDirectTenant.email}
                                                            onChange={e => setNewDirectTenant({ ...newDirectTenant, email: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Company Defaults Section */}
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">{t('users.sections.companyDefaults')}</h3>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.defaultCurrency')}</label>
                                                        <select
                                                            className="fancy-input w-full"
                                                            value={newDirectTenant.defaultCurrency}
                                                            onChange={e => setNewDirectTenant({ ...newDirectTenant, defaultCurrency: e.target.value })}
                                                        >
                                                            <option value="TND">TND</option>
                                                            <option value="EUR">EUR</option>
                                                            <option value="USD">USD</option>
                                                            <option value="GBP">GBP</option>
                                                            <option value="SAR">SAR</option>
                                                            <option value="QAR">QAR</option>
                                                            <option value="AED">AED</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.defaultLanguage')}</label>
                                                        <select
                                                            className="fancy-input w-full"
                                                            value={newDirectTenant.defaultLanguage}
                                                            onChange={e => setNewDirectTenant({ ...newDirectTenant, defaultLanguage: e.target.value })}
                                                        >
                                                            <option value="fr">Français</option>
                                                            <option value="en">English</option>
                                                            <option value="ar">العربية</option>
                                                            <option value="de">Deutsch</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.employeeLimit')}</label>
                                                        <input
                                                            type="number"
                                                            className="fancy-input w-full"
                                                            value={newDirectTenant.employeeLimit}
                                                            onChange={e => setNewDirectTenant({ ...newDirectTenant, employeeLimit: parseInt(e.target.value) || 0 })}
                                                            min={0}
                                                            placeholder={t('users.fields.employeeLimitPlaceholder')}
                                                        />
                                                        <p className="text-xs text-gray-400 mt-1">{t('users.fields.employeeLimitHint')}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-end space-x-3 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowTenantModal(false); setTenantMode('invite'); setNewDirectTenant({ companyName: '', address: '', taxId: '', phone: '', email: '', userEmail: '', userPassword: '', userFirstName: '', userLastName: '', defaultCurrency: 'TND', defaultLanguage: 'fr', employeeLimit: 0 }); }}
                                                    className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100"
                                                >
                                                    {t('common.cancel')}
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={actionLoading}
                                                    className="px-6 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    <UserPlus size={16} />
                                                    {actionLoading ? t('users.actions.creating') : t('users.actions.createTenant')}
                                                </button>
                                            </div>
                                        </form>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetPasswordModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-up">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <KeyRound className="text-amber-600" size={24} />
                                {t('users.actions.resetPassword')}
                            </h2>
                            <button onClick={() => setShowResetPasswordModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl mb-4">
                            <p className="text-sm text-gray-600">
                                {t('users.messages.resettingFor')} <span className="font-semibold">{selectedUser.firstName} {selectedUser.lastName}</span>
                            </p>
                            <p className="text-sm text-gray-500">{selectedUser.email}</p>
                        </div>
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.newPassword')}</label>
                                <input
                                    type="password"
                                    className="fancy-input w-full"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    placeholder={t('users.fields.newPasswordPlaceholder')}
                                />
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowResetPasswordModal(false)}
                                    className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 shadow-md disabled:opacity-50"
                                >
                                    {actionLoading ? t('users.actions.resetting') : t('users.actions.resetPassword')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
