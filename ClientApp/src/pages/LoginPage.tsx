import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, Loader, Clock, Phone, MessageCircle, RefreshCw } from 'lucide-react';
import { AxiosError } from 'axios';
import api from '../services/api';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage, getErrorStatus } from '../utils/errorUtils';
import { useTranslation } from 'react-i18next';
import { logger } from '../lib/logger';
import InlineMessage from '../components/InlineMessage';
import PasswordInput from '../components/PasswordInput';

type LoginTab = 'email' | 'whatsapp';
type WhatsAppStep = 'phone' | 'otp';

export default function LoginPage() {
    const { t } = useTranslation();
    const [tab, setTab] = useState<LoginTab>('email');
    const navigate = useNavigate();
    const { login } = useAuth();

    // ─── Email/password state ───
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [retryAfter, setRetryAfter] = useState(0);
    const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─── WhatsApp OTP state ───
    const [waPhone, setWaPhone] = useState('');
    const [waOtp, setWaOtp] = useState('');
    const [waStep, setWaStep] = useState<WhatsAppStep>('phone');
    const [waLoading, setWaLoading] = useState(false);
    const [waError, setWaError] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Countdown for email rate-limit
    useEffect(() => {
        if (retryAfter <= 0) {
            if (retryTimerRef.current) clearInterval(retryTimerRef.current);
            return;
        }
        retryTimerRef.current = setInterval(() => {
            setRetryAfter(prev => {
                if (prev <= 1) { if (retryTimerRef.current) clearInterval(retryTimerRef.current); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => { if (retryTimerRef.current) clearInterval(retryTimerRef.current); };
    }, [retryAfter]);

    // Countdown for WhatsApp resend
    useEffect(() => {
        if (resendCooldown <= 0) {
            if (resendTimerRef.current) clearInterval(resendTimerRef.current);
            return;
        }
        resendTimerRef.current = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) { if (resendTimerRef.current) clearInterval(resendTimerRef.current); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => { if (resendTimerRef.current) clearInterval(resendTimerRef.current); };
    }, [resendCooldown]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (retryAfter > 0) return;
        setEmailLoading(true);
        setEmailError('');
        try {
            const response = await api.post('/Auth/login', { email, password });
            const { accessToken, user } = response.data;
            if (!accessToken) { setEmailError(t('auth.messages.invalidServerResponse')); setEmailLoading(false); return; }
            const roles = user.Role ? [user.Role] : (user.role ? [user.role] : []);
            const isProfileComplete = user.IsProfileComplete ?? user.isProfileComplete ?? false;
            login(email, accessToken, roles, user.FirstName || user.firstName || '', user.LastName || user.lastName || '', isProfileComplete, user.BaseStoragePath || user.baseStoragePath);
            navigate(isProfileComplete ? '/dashboard' : '/company-init');
        } catch (err: unknown) {
            logger.error('Login Error:', err);
            if (getErrorStatus(err) === 429) {
                const retryHeader = err instanceof AxiosError ? err.response?.headers?.['retry-after'] : undefined;
                const seconds = retryHeader ? parseInt(retryHeader, 10) : 30;
                setRetryAfter(isNaN(seconds) ? 30 : seconds);
                setEmailError(t('auth.messages.rateLimit', { seconds: isNaN(seconds) ? 30 : seconds }));
                setEmailLoading(false);
                return;
            }
            const status = getErrorStatus(err);
            if (status === 401) setEmailError(t('auth.messages.wrongPassword'));
            else if (status === 404) setEmailError(t('auth.messages.accountNotFound'));
            else setEmailError(getErrorMessage(err, t('auth.messages.loginFailedGeneric')));
        } finally {
            setEmailLoading(false);
        }
    };

    const handleSendOtp = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!waPhone.trim()) { setWaError('Please enter your phone number.'); return; }
        setWaLoading(true);
        setWaError('');
        try {
            await api.post('/Auth/whatsapp/send-otp', { phoneNumber: waPhone });
            setWaStep('otp');
            setResendCooldown(60);
        } catch (err: unknown) {
            if (getErrorStatus(err) === 429) setWaError('Too many requests. Please wait before retrying.');
            else setWaError(getErrorMessage(err, 'Failed to send verification code. Please try again.'));
        } finally {
            setWaLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (waOtp.length !== 6) { setWaError('Please enter the 6-digit code.'); return; }
        setWaLoading(true);
        setWaError('');
        try {
            const response = await api.post('/Auth/whatsapp/verify-otp', { phoneNumber: waPhone, otp: waOtp });
            const { accessToken, user } = response.data;
            if (!accessToken) { setWaError(t('auth.messages.invalidServerResponse')); setWaLoading(false); return; }
            const roles = user.Role ? [user.Role] : (user.role ? [user.role] : []);
            const isProfileComplete = user.IsProfileComplete ?? user.isProfileComplete ?? false;
            login(user.Email || user.email || waPhone, accessToken, roles, user.FirstName || user.firstName || '', user.LastName || user.lastName || '', isProfileComplete, user.BaseStoragePath || user.baseStoragePath);
            navigate(isProfileComplete ? '/dashboard' : '/company-init');
        } catch (err: unknown) {
            if (getErrorStatus(err) === 401) setWaError('Invalid or expired code. Please try again.');
            else if (getErrorStatus(err) === 429) setWaError('Too many attempts. Please wait before retrying.');
            else setWaError(getErrorMessage(err, 'Verification failed. Please try again.'));
        } finally {
            setWaLoading(false);
        }
    };

    const isRateLimited = retryAfter > 0;

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">
            <div className="w-full max-w-md bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden animate-fade-in">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <img src="/logo.jpeg" alt={t('common.appName')} className="h-16 w-16 mx-auto mb-4 rounded-xl object-contain" />
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-purple-600">
                            {t('common.appName')}
                        </h1>
                        <p className="text-gray-500 mt-2">{t('auth.messages.signInPrompt')}</p>
                    </div>

                    {/* Tab switcher */}
                    <div className="flex rounded-xl border border-gray-200 p-1 mb-6 bg-gray-50">
                        <button
                            type="button"
                            onClick={() => { setTab('email'); setEmailError(''); }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
                                tab === 'email'
                                    ? "bg-white shadow-sm text-purple-700"
                                    : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            <Mail className="h-4 w-4" />
                            {t('auth.email')}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setTab('whatsapp'); setWaError(''); setWaStep('phone'); setWaOtp(''); }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
                                tab === 'whatsapp'
                                    ? "bg-white shadow-sm text-green-700"
                                    : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            <MessageCircle className="h-4 w-4" />
                            WhatsApp
                        </button>
                    </div>

                    {/* ─── Email / Password tab ─── */}
                    {tab === 'email' && (
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

                            {emailError && (
                                <InlineMessage
                                    variant={isRateLimited ? 'warning' : 'error'}
                                    onDismiss={() => { setEmailError(''); setRetryAfter(0); }}
                                >
                                    {emailError}
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
                                disabled={emailLoading || isRateLimited}
                                className={cn(
                                    "w-full py-3 px-4 rounded-xl text-white font-semibold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]",
                                    "bg-purple-600 hover:bg-purple-700",
                                    (emailLoading || isRateLimited) && "opacity-70 cursor-not-allowed"
                                )}
                            >
                                <div className="flex items-center justify-center space-x-2">
                                    {emailLoading ? (
                                        <><Loader className="animate-spin h-5 w-5" /><span>{t('auth.messages.signingIn')}</span></>
                                    ) : isRateLimited ? (
                                        <><Clock className="h-5 w-5" /><span>{t('auth.messages.pleaseWait', { seconds: retryAfter })}</span></>
                                    ) : (
                                        <><span>{t('auth.login')}</span><ArrowRight className="h-5 w-5" /></>
                                    )}
                                </div>
                            </button>
                        </form>
                    )}

                    {/* ─── WhatsApp OTP tab ─── */}
                    {tab === 'whatsapp' && (
                        <div className="space-y-6">
                            {waStep === 'phone' && (
                                <form onSubmit={handleSendOtp} className="space-y-4">
                                    <p className="text-sm text-gray-500 text-center">
                                        Enter your phone number and we'll send a verification code to your WhatsApp.
                                    </p>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 ms-1">Phone number</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                            <input
                                                type="tel"
                                                required
                                                value={waPhone}
                                                onChange={(e) => setWaPhone(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                                placeholder="+213 6XX XXX XXX"
                                            />
                                        </div>
                                    </div>

                                    {waError && (
                                        <InlineMessage variant="error" onDismiss={() => setWaError('')}>
                                            {waError}
                                        </InlineMessage>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={waLoading}
                                        className={cn(
                                            "w-full py-3 px-4 rounded-xl text-white font-semibold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]",
                                            "bg-green-600 hover:bg-green-700",
                                            waLoading && "opacity-70 cursor-not-allowed"
                                        )}
                                    >
                                        <div className="flex items-center justify-center space-x-2">
                                            {waLoading
                                                ? <><Loader className="animate-spin h-5 w-5" /><span>Sending…</span></>
                                                : <><MessageCircle className="h-5 w-5" /><span>Send Code via WhatsApp</span></>
                                            }
                                        </div>
                                    </button>
                                </form>
                            )}

                            {waStep === 'otp' && (
                                <form onSubmit={handleVerifyOtp} className="space-y-4">
                                    <p className="text-sm text-gray-500 text-center">
                                        A 6-digit code was sent to <span className="font-semibold text-gray-700">{waPhone}</span> via WhatsApp.
                                    </p>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 ms-1">Verification code</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            required
                                            value={waOtp}
                                            onChange={(e) => setWaOtp(e.target.value.replace(/\D/g, ''))}
                                            className="w-full text-center text-2xl tracking-[0.5em] py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white font-mono"
                                            placeholder="000000"
                                        />
                                    </div>

                                    {waError && (
                                        <InlineMessage variant="error" onDismiss={() => setWaError('')}>
                                            {waError}
                                        </InlineMessage>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={waLoading || waOtp.length !== 6}
                                        className={cn(
                                            "w-full py-3 px-4 rounded-xl text-white font-semibold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]",
                                            "bg-green-600 hover:bg-green-700",
                                            (waLoading || waOtp.length !== 6) && "opacity-70 cursor-not-allowed"
                                        )}
                                    >
                                        <div className="flex items-center justify-center space-x-2">
                                            {waLoading
                                                ? <><Loader className="animate-spin h-5 w-5" /><span>Verifying…</span></>
                                                : <><span>Verify & Sign in</span><ArrowRight className="h-5 w-5" /></>
                                            }
                                        </div>
                                    </button>

                                    <div className="text-center">
                                        {resendCooldown > 0 ? (
                                            <span className="text-sm text-gray-400 flex items-center justify-center gap-1.5">
                                                <Clock className="h-4 w-4" />
                                                Resend in {resendCooldown}s
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleSendOtp()}
                                                disabled={waLoading}
                                                className="text-sm text-green-600 hover:underline flex items-center justify-center gap-1.5 mx-auto"
                                            >
                                                <RefreshCw className="h-3.5 w-3.5" />
                                                Resend code
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => { setWaStep('phone'); setWaOtp(''); setWaError(''); }}
                                            className="text-sm text-gray-400 hover:text-gray-600 mt-1 block mx-auto"
                                        >
                                            Change number
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
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
