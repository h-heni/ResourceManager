import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Building, ArrowRight, Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { getErrorMessage } from '../utils/errorUtils';
import { cn } from '../lib/utils';

export default function SignUpPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        companyName: '',
        userFirstName: '',
        userLastName: '',
        userEmail: '',
        userPassword: '',
        confirmPassword: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.userPassword !== formData.confirmPassword) {
            setError(t('auth.messages.passwordsMismatch'));
            return;
        }

        if (formData.userPassword.length < 6) {
            setError(t('auth.messages.passwordMin'));
            return;
        }

        setLoading(true);

        try {
            await api.post('/Auth/signup', {
                companyName: formData.companyName,
                userFirstName: formData.userFirstName,
                userLastName: formData.userLastName,
                userEmail: formData.userEmail,
                userPassword: formData.userPassword,
            });
            alert(t('auth.messages.accountCreated'));
            navigate('/login');
        } catch (err: unknown) {
            console.error(err);
            const msg = getErrorMessage(err, t('auth.signupError'));
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">
            <div className="w-full max-w-md bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <Link to="/login" className="text-sm text-[#065F46] hover:underline mb-4 inline-block">
                            &larr; {t('auth.messages.backToLogin')}
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900">{t('auth.messages.createAccountTitle')}</h1>
                        <p className="text-sm text-gray-500 mt-2">
                            {t('auth.messages.createAccountSubtitle')}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Company Name */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">{t('client.companyName')}</label>
                            <div className="relative">
                                <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <input
                                    name="companyName"
                                    value={formData.companyName}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder={t('auth.placeholders.companyName')}
                                />
                            </div>
                        </div>

                        {/* First + Last Name */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">{t('users.fields.firstName')}</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <input
                                        name="userFirstName"
                                        value={formData.userFirstName}
                                        onChange={handleChange}
                                        required
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                        placeholder={t('auth.placeholders.firstName')}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">{t('users.fields.lastName')}</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <input
                                        name="userLastName"
                                        value={formData.userLastName}
                                        onChange={handleChange}
                                        required
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                        placeholder={t('auth.placeholders.lastName')}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">{t('common.email')}</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <input
                                    type="email"
                                    name="userEmail"
                                    value={formData.userEmail}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder={t('auth.placeholders.email')}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">{t('auth.password')}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <input
                                    type="password"
                                    name="userPassword"
                                    value={formData.userPassword}
                                    onChange={handleChange}
                                    required
                                    minLength={6}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder={t('auth.placeholders.password')}
                                />
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">{t('settings.confirmPassword')}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    minLength={6}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder={t('auth.placeholders.confirmPassword')}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={cn(
                                'w-full py-3 px-4 rounded-xl text-white font-semibold shadow-sm transition-all',
                                'bg-[#065F46] hover:bg-[#047857]',
                                loading && 'opacity-70 cursor-not-allowed'
                            )}
                        >
                            <div className="flex items-center justify-center gap-2">
                                {loading ? (
                                    <>
                                        <Loader className="animate-spin h-5 w-5" />
                                        <span>{t('auth.messages.creatingAccount')}</span>
                                    </>
                                ) : (
                                    <>
                                        <span>{t('auth.messages.createAccount')}</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </div>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
