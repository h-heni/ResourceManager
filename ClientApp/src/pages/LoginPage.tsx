import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader, AlertCircle, X, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';
import api from '../services/api';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage, getErrorStatus } from '../utils/errorUtils';
import { useTranslation } from 'react-i18next';

export default function LoginPage() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [retryAfter, setRetryAfter] = useState(0);
    const navigate = useNavigate();
    const { login } = useAuth();
    const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Countdown timer for rate-limit lockout
    useEffect(() => {
        if (retryAfter <= 0) {
            if (retryTimerRef.current) clearInterval(retryTimerRef.current);
            return;
        }
        retryTimerRef.current = setInterval(() => {
            setRetryAfter(prev => {
                if (prev <= 1) {
                    if (retryTimerRef.current) clearInterval(retryTimerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (retryTimerRef.current) clearInterval(retryTimerRef.current); };
    }, [retryAfter]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        // Block submission during rate-limit cooldown
        if (retryAfter > 0) return;

        setLoading(true);
        // Clear error only when user explicitly submits again
        setError('');

        try {
            const response = await api.post('/Auth/login', { email, password });
            const { accessToken, user } = response.data;

            if (!accessToken) {
                setError(t('auth.messages.invalidServerResponse'));
                setLoading(false);
                return; // Do NOT navigate
            }

            const roles = user.Role ? [user.Role] : (user.role ? [user.role] : []);
            const isProfileComplete = user.IsProfileComplete ?? user.isProfileComplete ?? false;
            login(
                email,
                accessToken,
                roles,
                user.FirstName || user.firstName || '',
                user.LastName || user.lastName || '',
                isProfileComplete,
                user.BaseStoragePath || user.baseStoragePath
            );
            toast.success(t('auth.messages.welcomeBack', { name: user.FirstName || user.firstName || email }));
            // Redirect: company init if profile not complete, otherwise dashboard
            navigate(isProfileComplete ? '/dashboard' : '/company-init');
        } catch (err: unknown) {
            console.error("Login Error:", err);

            // ─── Handle rate limiting (429) ───
            if (getErrorStatus(err) === 429) {
                const retryHeader = err instanceof AxiosError ? err.response?.headers?.['retry-after'] : undefined;
                const seconds = retryHeader ? parseInt(retryHeader, 10) : 30;
                setRetryAfter(isNaN(seconds) ? 30 : seconds);
                const rateMsg = t('auth.messages.rateLimit', { seconds: isNaN(seconds) ? 30 : seconds });
                setError(rateMsg);
                toast.error(rateMsg);
                setLoading(false);
                return; // Do NOT navigate, do NOT clear error
            }

            // ─── Handle all other errors ───
            const msg = getErrorMessage(err, t('auth.messages.loginFailedGeneric'));
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const isRateLimited = retryAfter > 0;

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">
            <div className="w-full max-w-md bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden animate-fade-in">
                <div className="p-8">
                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-[#065F46]">
                            {t('common.appName')}
                        </h1>
                        <p className="text-gray-500 mt-2">{t('auth.messages.signInPrompt')}</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">{t('auth.email')}</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <input
                                    id="login-email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder={t('auth.placeholders.email')}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">{t('auth.password')}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <input
                                    id="login-password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder={t('auth.placeholders.password')}
                                />
                            </div>
                        </div>

                        {/* ─── Error banner: persistent until dismissed or user retries ─── */}
                        {error && (
                            <div id="login-error" className={cn(
                                "p-3 rounded-lg text-sm flex items-start gap-2 animate-slide-up",
                                isRateLimited
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-red-50 text-red-600 border border-red-200"
                            )}>
                                {isRateLimited
                                    ? <Clock className="h-5 w-5 shrink-0 mt-0.5" />
                                    : <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                }
                                <span className="flex-1">{error}</span>
                                <button
                                    type="button"
                                    onClick={() => { setError(''); setRetryAfter(0); }}
                                    className="shrink-0 p-0.5 rounded hover:bg-red-100 transition-colors"
                                    aria-label={t('auth.messages.dismissError')}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {/* Rate-limit countdown */}
                        {isRateLimited && (
                            <div className="text-center text-amber-600 text-sm font-medium animate-pulse">
                                {t('auth.messages.retryIn', { seconds: retryAfter })}
                            </div>
                        )}

                        <button
                            id="login-submit"
                            type="submit"
                            disabled={loading || isRateLimited}
                            className={cn(
                                "w-full py-3 px-4 rounded-xl text-white font-semibold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]",
                                "bg-[#065F46] hover:bg-[#047857]",
                                (loading || isRateLimited) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <div className="flex items-center justify-center space-x-2">
                                {loading ? (
                                    <>
                                        <Loader className="animate-spin h-5 w-5" />
                                        <span>{t('auth.messages.signingIn')}</span>
                                    </>
                                ) : isRateLimited ? (
                                    <>
                                        <Clock className="h-5 w-5" />
                                        <span>{t('auth.messages.pleaseWait', { seconds: retryAfter })}</span>
                                    </>
                                ) : (
                                    <>
                                        <span>{t('auth.login')}</span>
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </div>
                        </button>
                    </form>
                </div>
                <div className="px-8 py-4 bg-gray-50 border-t border-gray-100/50 text-center">
                    <p className="text-sm text-gray-500">
                        {t('auth.messages.noAccount')}{' '}
                        <span onClick={() => navigate('/signup')} className="text-[#065F46] font-semibold cursor-pointer hover:underline">{t('auth.messages.createAccount')}</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
