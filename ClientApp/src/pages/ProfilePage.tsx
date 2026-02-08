import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Lock, Save, AlertCircle, CheckCircle } from 'lucide-react';

export default function ProfilePage() {
    const { user, displayName } = useAuth();
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setStatus({ type: 'error', message: "New passwords do not match" });
            return;
        }

        setLoading(true);
        try {
            await api.post('/Auth/change-password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });
            setStatus({ type: 'success', message: "Password updated successfully" });
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            const msg = error.response?.data?.map ? error.response.data.map((e: any) => e.description).join(', ') : (error.response?.data?.message || "Failed to update password");
            setStatus({ type: 'error', message: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* User Info Card */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                        <div className="h-24 w-24 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-full mx-auto flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-4">
                            {displayName[0]?.toUpperCase() || user?.email[0]?.toUpperCase() || '?'}
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
                        <p className="text-sm text-gray-500">{user?.email}</p>
                        <div className="mt-2 flex flex-wrap justify-center gap-2">
                            {user?.roles.map(role => (
                                <span key={role} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-semibold">
                                    {role}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Change Password Form */}
                <div className="md:col-span-2">
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center space-x-3 mb-6">
                            <Lock className="text-indigo-600" size={24} />
                            <h2 className="text-xl font-bold text-gray-900">Security</h2>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                                <input
                                    type="password"
                                    required
                                    className="fancy-input w-full"
                                    value={passwordData.currentPassword}
                                    onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        className="fancy-input w-full"
                                        value={passwordData.newPassword}
                                        onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        className="fancy-input w-full"
                                        value={passwordData.confirmPassword}
                                        onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    />
                                </div>
                            </div>

                            {status && (
                                <div className={`p-4 rounded-xl flex items-center space-x-2 ${
                                    status.type === 'success' 
                                        ? 'bg-green-50 border border-green-300 text-green-800' 
                                        : 'bg-red-50 border border-red-300 text-red-800'
                                }`}>
                                    {status.type === 'success' ? <CheckCircle size={20} className="text-green-600 flex-shrink-0" /> : <AlertCircle size={20} className="text-red-600 flex-shrink-0" />}
                                    <span>{status.message}</span>
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex items-center space-x-2 bg-gray-900 text-white px-6 py-2 rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50"
                                >
                                    <Save size={18} />
                                    <span>{loading ? 'Updating...' : 'Update Password'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
