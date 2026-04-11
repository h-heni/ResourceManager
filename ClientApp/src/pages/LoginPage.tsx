import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, Loader, Clock } from 'lucide-react';
import { AxiosError } from 'axios';
import api from '../services/api';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage, getErrorStatus } from '../utils/errorUtils';
import { useTranslation } from 'react-i18next';
import { logger } from '../lib/logger';
import InlineMessage from '../components/InlineMessage';
import PasswordInput from '../components/PasswordInput';

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
            navigate(isProfileComplete ? '/dashboard' : '/company-init');
        } catch (err: unknown) {
            logger.error('Login Error:', err);

            // ─── Handle rate limiting (429) ───
            if (getErrorStatus(err) === 429) {
                const retryHeader = err instanceof AxiosError ? err.response?.headers?.['retry-after'] : undefined;
                const seconds = retryHeader ? parseInt(retryHeader, 10) : 30;
                setRetryAfter(isNaN(seconds) ? 30 : seconds);
                setError(t('auth.messages.rateLimit', { seconds: isNaN(seconds) ? 30 : seconds }));
                setLoading(false);
                return;
            }

            // ─── Contextual error messages ───
            const status = getErrorStatus(err);
            if (status === 401) {
                setError(t('auth.messages.wrongPassword'));
            } else if (status === 404) {
                setError(t('auth.messages.accountNotFound'));
            } else {
                setError(getErrorMessage(err, t('auth.messages.loginFailedGeneric')));
            }
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
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-purple-600">
                            {t('common.appName')}
                        </h1>
                        <p className="text-gray-500 mt-2">{t('auth.messages.signInPrompt')}</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ms-1">{t('auth.email')}</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <input
                                    id="login-email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder={t('auth.placeholders.email')}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ms-1">{t('auth.password')}</label>
                            <PasswordInput
                                id="login-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('auth.placeholders.password')}
                            />
                            <div className="text-right">
                                <span 
                                    onClick={() => navigate('/forgot-password')} 
                                    className="text-sm text-purple-600 hover:underline cursor-pointer"
                                >
                                    {t('auth.forgotPassword')}
                                </span>
                            </div>
                        </div>

                        {/* Inline error / rate-limit banner */}
                        {error && (
                            <InlineMessage
                                variant={isRateLimited ? 'warning' : 'error'}
                                onDismiss={() => { setError(''); setRetryAfter(0); }}
                            >
                                {error}
                            </InlineMessage>
                        )}

                        {isRateLimited && (
                            <div className="text-center text-amber-600 text-sm font-medium animate-pulse flex items-center justify-center gap-1.5">
                                <Clock className="size-4" />
                                {t('auth.messages.retryIn', { seconds: retryAfter })}
                            </div>
                        )}

                        <button
                            id="login-submit"
                            type="submit"
                            disabled={loading || isRateLimited}
                            className={cn(
                                "w-full py-3 px-4 rounded-xl text-white font-semibold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]",
                                "bg-purple-600 hover:bg-purple-700",
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
                        <span onClick={() => navigate('/signup')} className="text-purple-600 font-semibold cursor-pointer hover:underline">{t('auth.messages.createAccount')}</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
