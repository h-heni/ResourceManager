import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, User, Building, ArrowRight, Loader, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { getErrorMessage } from '../utils/errorUtils';
import { cn } from '../lib/utils';
import { logger } from '../lib/logger';
import InlineMessage from '../components/InlineMessage';
import PasswordInput from '../components/PasswordInput';

export default function SignUpPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

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
            setSuccess(true);
        } catch (err: unknown) {
            logger.error('Signup error:', err);
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
                        <Link to="/login" className="text-sm text-purple-600 hover:underline mb-4 inline-block">
                            &larr; {t('auth.messages.backToLogin')}
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900">{t('auth.messages.createAccountTitle')}</h1>
                        <p className="text-sm text-gray-500 mt-2">
                            {t('auth.messages.createAccountSubtitle')}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Success state */}
                        {success && (
                            <div className="text-center space-y-4 py-6">
                                <div className="mx-auto size-16 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <CheckCircle className="size-8 text-emerald-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">{t('auth.messages.accountCreated')}</h3>
                                <p className="text-sm text-gray-500">{t('auth.messages.accountCreatedDetail')}</p>
                                <button
                                    type="button"
                                    onClick={() => navigate('/login')}
                                    className="mt-2 px-6 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors"
                                >
                                    {t('auth.login')}
                                </button>
                            </div>
                        )}
                        {!success && (<>
                        {/* Company Name */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">{t('client.companyName')}</label>
                            <div className="relative">
                                <Building className="absolute start-3 top-3 h-4 w-4 text-gray-400" />
                                <input
                                    name="companyName"
                                    value={formData.companyName}
                                    onChange={handleChange}
                                    required
                                    className="w-full ps-10 pe-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder={t('auth.placeholders.companyName')}
                                />
                            </div>
                        </div>

                        {/* First + Last Name */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">{t('users.fields.firstName')}</label>
                                <div className="relative">
                                    <User className="absolute start-3 top-3 h-4 w-4 text-gray-400" />
                                    <input
                                        name="userFirstName"
                                        value={formData.userFirstName}
                                        onChange={handleChange}
                                        required
                                        className="w-full ps-10 pe-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                        placeholder={t('auth.placeholders.firstName')}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">{t('users.fields.lastName')}</label>
                                <div className="relative">
                                    <User className="absolute start-3 top-3 h-4 w-4 text-gray-400" />
                                    <input
                                        name="userLastName"
                                        value={formData.userLastName}
                                        onChange={handleChange}
                                        required
                                        className="w-full ps-10 pe-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                        placeholder={t('auth.placeholders.lastName')}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">{t('common.email')}</label>
                            <div className="relative">
                                <Mail className="absolute start-3 top-3 h-4 w-4 text-gray-400" />
                                <input
                                    type="email"
                                    name="userEmail"
                                    value={formData.userEmail}
                                    onChange={handleChange}
                                    required
                                    className="w-full ps-10 pe-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder={t('auth.placeholders.email')}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">{t('auth.password')}</label>
                            <PasswordInput
                                name="userPassword"
                                value={formData.userPassword}
                                onChange={handleChange}
                                required
                                minLength={6}
                                showChecklist
                                checklistLabels={{
                                    length: t('auth.checklist.length', 'At least 6 characters'),
                                    uppercase: t('auth.checklist.uppercase', 'One uppercase letter'),
                                    number: t('auth.checklist.number', 'One number'),
                                    special: t('auth.checklist.special', 'One special character'),
                                }}
                                placeholder={t('auth.placeholders.password')}
                            />
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">{t('settings.confirmPassword')}</label>
                            <PasswordInput
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                minLength={6}
                                placeholder={t('auth.placeholders.confirmPassword')}
                            />
                        </div>

                        {error && (
                            <InlineMessage variant="error" onDismiss={() => setError('')}>
                                {error}
                            </InlineMessage>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={cn(
                                'w-full py-3 px-4 rounded-xl text-white font-semibold shadow-sm transition-all',
                                'bg-purple-600 hover:bg-purple-700',
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
                        </>)}
                    </form>
                </div>
            </div>
        </div>
    );
}
