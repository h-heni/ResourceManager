import { useEffect, useState } from 'react';
import api from '../services/api';
import { getErrorMessage, getErrorStatus, getAxiosResponseData } from '../utils/errorUtils';
import { useAuth } from '../context/AuthContext';
import { Plus, Users, AlertCircle, Trash2, KeyRound, X, Building2, Settings } from 'lucide-react';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../lib/currencyUtils';
import { useTranslation } from 'react-i18next';

interface UserDto {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    company?: string;
    companyId?: number;
}

interface CompanyOption {
    id: number;
    name: string;
}

export default function UsersPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [users, setUsers] = useState<UserDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [showTenantModal, setShowTenantModal] = useState(false);
    const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const isSuperAdmin = user?.roles?.includes('SuperAdmin');
    const isManager = user?.roles?.includes('Manager') || user?.roles?.includes('FreeUser');
    const canManageUsers = isSuperAdmin || isManager;

    // Form States
    const [newEmployee, setNewEmployee] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        companyId: null as number | null
    });

    const [companies, setCompanies] = useState<CompanyOption[]>([]);

    const [newTenant, setNewTenant] = useState({
        companyName: '',
        address: '',
        matriculeFiscal: '',
        phone: '',
        email: '',
        userEmail: '',
        userPassword: '',
        userFirstName: '',
        userLastName: '',
        defaultCurrency: DEFAULT_CURRENCY,
        defaultLanguage: 'fr',
        employeeLimit: 0
    });

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

            // SuperAdmin: extract unique companies from user list for the employee dropdown
            if (isSuperAdmin) {
                const rawUsers: UserDto[] = Array.isArray(data) ? data : (data.data || []);
                const companyMap = new Map<number, string>();
                rawUsers.forEach(u => {
                    if (u.companyId && u.companyId > 0 && u.company && u.company !== 'N/A') {
                        companyMap.set(u.companyId, u.company);
                    }
                });
                setCompanies(Array.from(companyMap, ([id, name]) => ({ id, name })));
            }
        } catch (err: unknown) {
            console.error("Failed to fetch users", err);
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
        if (isSuperAdmin && !newEmployee.companyId) {
            alert('Please select a company for this employee.');
            return;
        }
        setActionLoading(true);
        try {
            const payload: Record<string, unknown> = {
                email: newEmployee.email,
                password: newEmployee.password,
                firstName: newEmployee.firstName,
                lastName: newEmployee.lastName
            };
            if (isSuperAdmin && newEmployee.companyId) {
                payload.companyId = newEmployee.companyId;
            }
            await api.post('/Auth/register-manual', payload);
            setShowEmployeeModal(false);
            setNewEmployee({ email: '', password: '', firstName: '', lastName: '', companyId: null });
            fetchUsers();
            alert(t('users.messages.employeeCreated'));
        } catch (err: unknown) {
            console.error("Failed to create employee", err);
            const responseData = getAxiosResponseData(err);
            const errorMsg = responseData?.errors
                ? Object.values(responseData.errors as Record<string, string[]>).flat().join(', ')
                : getErrorMessage(err, t('users.messages.employeeCreateFailed'));
            alert(errorMsg);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            await api.post('/Auth/create-tenant', newTenant);
            setShowTenantModal(false);
            setNewTenant({
                companyName: '', address: '', matriculeFiscal: '', phone: '', email: '',
                userEmail: '', userPassword: '', userFirstName: '', userLastName: '',
                defaultCurrency: DEFAULT_CURRENCY, defaultLanguage: 'fr', employeeLimit: 0
            });
            fetchUsers();
            alert(t('users.messages.tenantCreated'));
        } catch (err: unknown) {
            console.error("Failed to create tenant", err);
            const errorMsg = getErrorMessage(err, t('users.messages.tenantCreateFailed'));
            alert(errorMsg);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteUser = async (targetUser: UserDto) => {
        if (targetUser.email === user?.email) {
            alert(t('users.messages.cannotDeleteSelf'));
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
            alert(t('users.messages.deleted'));
        } catch (err: unknown) {
            console.error("Failed to delete user", err);
            const errorMsg = getErrorMessage(err, t('users.messages.deleteFailed'));
            alert(errorMsg);
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        if (newPassword.length < 6) {
            alert(t('users.messages.passwordMin'));
            return;
        }

        setActionLoading(true);
        try {
            await api.post(`/Users/${selectedUser.id}/reset-password`, { newPassword });
            setShowResetPasswordModal(false);
            setSelectedUser(null);
            setNewPassword('');
            alert(t('users.messages.passwordResetSuccess'));
        } catch (err: unknown) {
            console.error("Failed to reset password", err);
            const errorMsg = getErrorMessage(err, t('users.messages.passwordResetFailed'));
            alert(errorMsg);
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
            alert(t('users.messages.resetSettingsSuccess'));
        } catch (err: unknown) {
            alert(getErrorMessage(err, t('users.messages.resetSettingsFailed')));
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
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('users.title')}</h1>
                    <p className="text-gray-500 mt-1">
                        {isSuperAdmin 
                            ? t('users.messages.manageSuperAdmin')
                            : t('users.messages.manageManager')}
                    </p>
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

            <div className="rm-table-card">
                <table className="rm-table">
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
                                        <div className="ml-4">
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
                            {isSuperAdmin && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.company', 'Company')}</label>
                                    <select
                                        className="fancy-input w-full"
                                        value={newEmployee.companyId ?? ''}
                                        onChange={e => setNewEmployee({ ...newEmployee, companyId: e.target.value ? parseInt(e.target.value) : null })}
                                        required
                                    >
                                        <option value="">{t('users.fields.selectCompany', 'Select a company...')}</option>
                                        {companies.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
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
                                <Building2 className="text-emerald-600" size={24} />
                                {t('users.actions.addTenant')}
                            </h2>
                            <button onClick={() => setShowTenantModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">
                            Create a new company with a manager account. This will set up a complete tenant.
                        </p>
                        <form onSubmit={handleCreateTenant} className="space-y-6">
                            {/* Company Section */}
                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                                <h3 className="font-semibold text-emerald-800 mb-4">{t('users.sections.companyInfo')}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.companyNameRequired')}</label>
                                        <input
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={newTenant.companyName}
                                            onChange={e => setNewTenant({ ...newTenant, companyName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.addressRequired')}</label>
                                        <input
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={newTenant.address}
                                            onChange={e => setNewTenant({ ...newTenant, address: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.fiscalIdRequired')}</label>
                                        <input
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={newTenant.matriculeFiscal}
                                            onChange={e => setNewTenant({ ...newTenant, matriculeFiscal: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.phone')}</label>
                                        <input
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={newTenant.phone}
                                            onChange={e => setNewTenant({ ...newTenant, phone: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.companyEmail')}</label>
                                        <input
                                            type="email"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={newTenant.email}
                                            onChange={e => setNewTenant({ ...newTenant, email: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Manager Section */}
                            <div className="p-4 bg-[#065F46]/5 rounded-xl border border-[#065F46]/20">
                                <h3 className="font-semibold text-[#065F46] mb-4">{t('users.sections.managerAccount')}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.firstNameRequired')}</label>
                                        <input
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none"
                                            value={newTenant.userFirstName}
                                            onChange={e => setNewTenant({ ...newTenant, userFirstName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.lastNameRequired')}</label>
                                        <input
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none"
                                            value={newTenant.userLastName}
                                            onChange={e => setNewTenant({ ...newTenant, userLastName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.emailRequired')}</label>
                                        <input
                                            type="email"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none"
                                            value={newTenant.userEmail}
                                            onChange={e => setNewTenant({ ...newTenant, userEmail: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.passwordRequired')}</label>
                                        <input
                                            type="password"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] outline-none"
                                            value={newTenant.userPassword}
                                            onChange={e => setNewTenant({ ...newTenant, userPassword: e.target.value })}
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Defaults Section */}
                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                                <h3 className="font-semibold text-amber-800 mb-4">{t('users.sections.companyDefaults')}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.defaultCurrency')}</label>
                                        <select
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                                            value={newTenant.defaultCurrency}
                                            onChange={e => setNewTenant({ ...newTenant, defaultCurrency: e.target.value })}
                                        >
                                            {CURRENCY_OPTIONS.map(opt => (
                                                <option key={opt.code} value={opt.code}>
                                                    {opt.symbol} — {opt.code}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fields.defaultLanguage')}</label>
                                        <select
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                                            value={newTenant.defaultLanguage}
                                            onChange={e => setNewTenant({ ...newTenant, defaultLanguage: e.target.value })}
                                        >
                                            <option value="fr">{t('language.fr')}</option>
                                            <option value="en">{t('language.en')}</option>
                                            <option value="de">{t('language.de')}</option>
                                            <option value="ar">{t('language.ar')}</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {t('users.fields.employeeLimit')}
                                            <span className="text-gray-400 font-normal ml-1">{t('users.fields.employeeLimitHint')}</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                                            value={newTenant.employeeLimit}
                                            onChange={e => setNewTenant({ ...newTenant, employeeLimit: parseInt(e.target.value) || 0 })}
                                            placeholder={t('users.fields.employeeLimitPlaceholder')}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowTenantModal(false)}
                                    className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-6 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-md disabled:opacity-50"
                                >
                                    {actionLoading ? t('users.actions.creating') : t('users.actions.createTenant')}
                                </button>
                            </div>
                        </form>
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
