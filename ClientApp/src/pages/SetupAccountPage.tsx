import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Building2, User, Lock, AlertCircle, CheckCircle, Loader2, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface FormData {
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    phone: string;
    companyName: string;
    companyAddress: string;
    companyCity: string;
    taxNumber: string;
    defaultCurrency: string;
    defaultLanguage: string;
}

export default function SetupAccountPage() {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token') || '';

    const [validating, setValidating] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [tokenError, setTokenError] = useState('');
    const [invitedEmail, setInvitedEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [success, setSuccess] = useState(false);

    const [form, setForm] = useState<FormData>({
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        phone: '',
        companyName: '',
        companyAddress: '',
        companyCity: '',
        taxNumber: '',
        defaultCurrency: 'TND',
        defaultLanguage: 'fr',
    });

    // Validate token on page load
    useEffect(() => {
        if (!token) {
            setTokenError(t('invitation.tokenRequired', 'No invitation token provided.'));
            setValidating(false);
            return;
        }

        const validateToken = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/invitations/validate`, {
                    params: { token }
                });
                if (res.data.valid) {
                    setTokenValid(true);
                    setInvitedEmail(res.data.email);
                    // Apply preferred language from invitation
                    const lang = res.data.preferredLanguage;
                    if (lang) {
                        setForm(prev => ({ ...prev, defaultLanguage: lang }));
                        import('../i18n').then(() => {
                            import('i18next').then(({ default: i18n }) => {
                                i18n.changeLanguage(lang);
                                localStorage.setItem('language', lang);
                            });
                        });
                    }
                } else {
                    setTokenError(res.data.error || t('invitation.invalidOrExpired', 'This invitation is invalid or expired.'));
                }
            } catch {
                setTokenError(t('invitation.validationFailed', 'Failed to validate invitation. Please try again.'));
            } finally {
                setValidating(false);
            }
        };

        validateToken();
    }, [token, t]);

    const handleChange = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const lang = e.target.value;
        setForm(prev => ({ ...prev, defaultLanguage: lang }));
        // Apply language immediately to the app
        import('../i18n').then(() => {
            import('i18next').then(({ default: i18n }) => {
                i18n.changeLanguage(lang);
                localStorage.setItem('language', lang);
            });
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');

        if (form.password !== form.confirmPassword) {
            setSubmitError(t('invitation.passwordMismatch', 'Passwords do not match.'));
            return;
        }

        if (form.password.length < 6) {
            setSubmitError(t('invitation.passwordMinLength', 'Password must be at least 6 characters.'));
            return;
        }

        setSubmitting(true);
        try {
            await axios.post(`${API_URL}/api/invitations/complete`, {
                token,
                password: form.password,
                firstName: form.firstName,
                lastName: form.lastName,
                phone: form.phone,
                companyName: form.companyName,
                companyAddress: form.companyAddress,
                companyCity: form.companyCity,
                taxNumber: form.taxNumber,
                defaultCurrency: form.defaultCurrency,
                defaultLanguage: form.defaultLanguage,
            });
            setSuccess(true);
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.data) {
                const data = err.response.data;
                setSubmitError(data.error || data.message || t('invitation.createFailed', 'Failed to create account.'));
            } else {
                setSubmitError(t('invitation.unexpectedError', 'An unexpected error occurred. Please try again.'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Loading state
    if (validating) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="animate-spin h-10 w-10 text-emerald-600 mx-auto mb-4" />
                    <p className="text-gray-600">{t('invitation.validatingToken', 'Validating your invitation...')}</p>
                </div>
            </div>
        );
    }

    // Invalid token
    if (!tokenValid) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
                    <div className="size-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="text-red-600" size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        {t('invitation.invalidTitle', 'Invalid Invitation')}
                    </h2>
                    <p className="text-gray-500 mb-6">{tokenError}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                        {t('invitation.goToLogin', 'Go to Login')}
                    </button>
                </div>
            </div>
        );
    }

    // Success
    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
                    <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="text-emerald-600" size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        {t('invitation.successTitle', 'Account Created Successfully!')}
                    </h2>
                    <p className="text-gray-500 mb-6">
                        {t('invitation.successDesc', 'Your account and company have been set up. You can now log in.')}
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                        {t('invitation.goToLogin', 'Go to Login')}
                    </button>
                </div>
            </div>
        );
    }

    // Registration form
    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 max-h-[95vh] overflow-y-auto">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {t('invitation.setupTitle', 'Set Up Your Account')}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {t('invitation.setupDesc', 'Complete your profile and company details to get started.')}
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm">
                        <User size={14} />
                        {invitedEmail}
                    </div>
                </div>

                {submitError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                        <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={18} />
                        <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Language Selection — FIRST STEP */}
                    <div className="p-5 bg-purple-50 rounded-xl border border-purple-200">
                        <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                            <Globe size={18} />
                            {t('invitation.languageSection', 'Choose Your Language')}
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            {t('invitation.languageSectionDesc', 'Select your preferred language. The entire form and application will switch immediately.')}
                        </p>
                        <select
                            className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white text-base"
                            value={form.defaultLanguage}
                            onChange={handleLanguageChange}
                        >
                            <option value="fr">🇫🇷 Français</option>
                            <option value="en">🇺🇸 English</option>
                            <option value="ar">🇸🇦 العربية</option>
                            <option value="de">🇩🇪 Deutsch</option>
                        </select>
                    </div>

                    {/* Profile Section */}
                    <div className="p-5 bg-purple-600/5 rounded-xl border border-purple-600/20">
                        <h3 className="font-semibold text-purple-600 mb-4 flex items-center gap-2">
                            <User size={18} />
                            {t('invitation.profileSection', 'Profile Information')}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('invitation.firstName', 'First Name')} *
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    value={form.firstName}
                                    onChange={handleChange('firstName')}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('invitation.lastName', 'Last Name')} *
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    value={form.lastName}
                                    onChange={handleChange('lastName')}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('common.phone', 'Phone')}
                                </label>
                                <input
                                    type="tel"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    value={form.phone}
                                    onChange={handleChange('phone')}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Lock size={14} className="inline mr-1" />
                                    {t('invitation.password', 'Password')} *
                                </label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    value={form.password}
                                    onChange={handleChange('password')}
                                    required
                                    minLength={6}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Lock size={14} className="inline mr-1" />
                                    {t('invitation.confirmPassword', 'Confirm Password')} *
                                </label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    value={form.confirmPassword}
                                    onChange={handleChange('confirmPassword')}
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Company Section */}
                    <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-200">
                        <h3 className="font-semibold text-emerald-800 mb-4 flex items-center gap-2">
                            <Building2 size={18} />
                            {t('invitation.companySection', 'Company Information')}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('invitation.companyName', 'Company Name')} *
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={form.companyName}
                                    onChange={handleChange('companyName')}
                                    required
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('invitation.companyAddress', 'Address')} *
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={form.companyAddress}
                                    onChange={handleChange('companyAddress')}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('invitation.city', 'City')}
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={form.companyCity}
                                    onChange={handleChange('companyCity')}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('invitation.taxNumber', 'Tax Number')}
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={form.taxNumber}
                                    onChange={handleChange('taxNumber')}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 px-6 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                {t('invitation.creating', 'Creating account...')}
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} />
                                {t('invitation.createAccount', 'Create Account & Company')}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
