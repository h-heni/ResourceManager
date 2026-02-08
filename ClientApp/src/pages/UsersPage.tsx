import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Users, AlertCircle, Trash2, KeyRound, X, Building2 } from 'lucide-react';

interface UserDto {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    company?: string;
    companyId?: number;
}

export default function UsersPage() {
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
        lastName: ''
    });

    const [newTenant, setNewTenant] = useState({
        companyName: '',
        address: '',
        matriculeFiscal: '',
        phone: '',
        email: '',
        userEmail: '',
        userPassword: '',
        userFirstName: '',
        userLastName: ''
    });

    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/Users');
            setUsers(Array.isArray(res.data) ? res.data : []);
        } catch (err: any) {
            console.error("Failed to fetch users", err);
            if (err.response?.status === 403) {
                setError("You don't have permission to view users. Only Managers can access this page.");
            } else if (err.response?.status === 401) {
                setError("Please log in to access this page.");
            } else {
                setError("Failed to load users. Please try again.");
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
            alert("Employee created successfully!");
        } catch (err: any) {
            console.error("Failed to create employee", err);
            const errorMsg = err.response?.data?.errors 
                ? Object.values(err.response.data.errors).flat().join(', ')
                : err.response?.data?.message || "Failed to create employee.";
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
                userEmail: '', userPassword: '', userFirstName: '', userLastName: ''
            });
            fetchUsers();
            alert("New tenant (company + manager) created successfully!");
        } catch (err: any) {
            console.error("Failed to create tenant", err);
            const errorMsg = err.response?.data?.message || err.response?.data || "Failed to create tenant.";
            alert(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteUser = async (targetUser: UserDto) => {
        if (targetUser.id === user?.id) {
            alert("You cannot delete your own account.");
            return;
        }

        const confirmMsg = `Are you sure you want to delete ${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})?\n\nTheir work records (invoices, quotes, etc.) will remain intact.`;
        if (!confirm(confirmMsg)) return;

        setActionLoading(true);
        try {
            await api.delete(`/Users/${targetUser.id}`);
            fetchUsers();
            alert("User deleted successfully. Their work records remain intact.");
        } catch (err: any) {
            console.error("Failed to delete user", err);
            const errorMsg = err.response?.data?.message || err.response?.data || "Failed to delete user.";
            alert(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        if (newPassword.length < 6) {
            alert("Password must be at least 6 characters.");
            return;
        }

        setActionLoading(true);
        try {
            await api.post(`/Users/${selectedUser.id}/reset-password`, { newPassword });
            setShowResetPasswordModal(false);
            setSelectedUser(null);
            setNewPassword('');
            alert("Password reset successfully!");
        } catch (err: any) {
            console.error("Failed to reset password", err);
            const errorMsg = err.response?.data?.message || err.response?.data || "Failed to reset password.";
            alert(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
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
        if (targetUser.id === user?.id) return false;
        if (isSuperAdmin && targetUser.role !== 'SuperAdmin') return true;
        if (isManager && targetUser.role === 'Employee' && !isSuperAdmin) return true;
        return false;
    };

    const canResetPassword = (targetUser: UserDto) => {
        if (isSuperAdmin) return true;
        if (isManager && targetUser.role === 'Employee') return true;
        return false;
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading users...</div>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle size={48} className="text-red-400 mb-4" />
            <p className="text-red-600 font-medium">{error}</p>
            <button 
                onClick={fetchUsers}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
            >
                Retry
            </button>
        </div>
    );

    if (!canManageUsers) return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <Users size={48} className="text-gray-400 mb-4" />
            <p className="text-gray-600 font-medium">Only Managers can access user management.</p>
        </div>
    );

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                    <p className="text-gray-500 mt-1">
                        {isSuperAdmin 
                            ? "Manage all users and create new tenants (companies)." 
                            : "Manage credentials and access for your team."}
                    </p>
                </div>
                <div className="flex gap-3">
                    {isSuperAdmin && (
                        <button
                            onClick={() => setShowTenantModal(true)}
                            className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all"
                        >
                            <Building2 size={20} />
                            <span>Add Tenant</span>
                        </button>
                    )}
                    <button
                        onClick={() => setShowEmployeeModal(true)}
                        className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all"
                    >
                        <Plus size={20} />
                        <span>Add Employee</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                            {isSuperAdmin && (
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                            )}
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.map((u) => (
                            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                            {u.firstName?.[0] || u.email[0].toUpperCase()}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</div>
                                            <div className="text-sm text-gray-500">{u.email}</div>
                                        </div>
                                    </div>
                                </td>
                                {isSuperAdmin && (
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-gray-700">{u.company || 'N/A'}</span>
                                    </td>
                                )}
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                        u.role === 'SuperAdmin' ? 'bg-red-50 text-red-600' :
                                        u.role === 'Manager' || u.role === 'FreeUser' ? 'bg-purple-50 text-purple-600' :
                                        'bg-blue-50 text-blue-600'
                                    }`}>
                                        {u.role || "Employee"}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600">
                                        Active
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                        {canResetPassword(u) && (
                                            <button
                                                onClick={() => openResetPasswordModal(u)}
                                                className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                title="Reset Password"
                                            >
                                                <KeyRound size={18} />
                                            </button>
                                        )}
                                        {canDeleteUser(u) && (
                                            <button
                                                onClick={() => handleDeleteUser(u)}
                                                disabled={actionLoading}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                title="Delete User"
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
                                <td colSpan={isSuperAdmin ? 5 : 4} className="px-6 py-10 text-center text-gray-500">
                                    No users found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Employee Modal */}
            {showEmployeeModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-up">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Add New Employee</h2>
                            <button onClick={() => setShowEmployeeModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateEmployee} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                    <input
                                        className="fancy-input w-full"
                                        value={newEmployee.firstName}
                                        onChange={e => setNewEmployee({ ...newEmployee, firstName: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                    <input
                                        className="fancy-input w-full"
                                        value={newEmployee.lastName}
                                        onChange={e => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    className="fancy-input w-full"
                                    value={newEmployee.email}
                                    onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
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
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-md disabled:opacity-50"
                                >
                                    {actionLoading ? 'Creating...' : 'Create Employee'}
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
                                Create New Tenant
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
                                <h3 className="font-semibold text-emerald-800 mb-4">Company Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                                        <input
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={newTenant.companyName}
                                            onChange={e => setNewTenant({ ...newTenant, companyName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                                        <input
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={newTenant.address}
                                            onChange={e => setNewTenant({ ...newTenant, address: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Matricule Fiscal *</label>
                                        <input
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={newTenant.matriculeFiscal}
                                            onChange={e => setNewTenant({ ...newTenant, matriculeFiscal: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                        <input
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={newTenant.phone}
                                            onChange={e => setNewTenant({ ...newTenant, phone: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Email</label>
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
                            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                                <h3 className="font-semibold text-indigo-800 mb-4">Manager Account</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                                        <input
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newTenant.userFirstName}
                                            onChange={e => setNewTenant({ ...newTenant, userFirstName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                                        <input
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newTenant.userLastName}
                                            onChange={e => setNewTenant({ ...newTenant, userLastName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                        <input
                                            type="email"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newTenant.userEmail}
                                            onChange={e => setNewTenant({ ...newTenant, userEmail: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                                        <input
                                            type="password"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newTenant.userPassword}
                                            onChange={e => setNewTenant({ ...newTenant, userPassword: e.target.value })}
                                            required
                                            minLength={6}
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
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-6 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-md disabled:opacity-50"
                                >
                                    {actionLoading ? 'Creating...' : 'Create Tenant'}
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
                                Reset Password
                            </h2>
                            <button onClick={() => setShowResetPasswordModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl mb-4">
                            <p className="text-sm text-gray-600">
                                Resetting password for: <span className="font-semibold">{selectedUser.firstName} {selectedUser.lastName}</span>
                            </p>
                            <p className="text-sm text-gray-500">{selectedUser.email}</p>
                        </div>
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                <input
                                    type="password"
                                    className="fancy-input w-full"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    placeholder="Minimum 6 characters"
                                />
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowResetPasswordModal(false)}
                                    className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 shadow-md disabled:opacity-50"
                                >
                                    {actionLoading ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
