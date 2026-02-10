import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader, AlertCircle, X, Clock } from 'lucide-react';
import api from '../services/api';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
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
                setError("Server returned an invalid response. Please try again.");
                setLoading(false);
                return; // Do NOT navigate
            }

            const roles = user.Role ? [user.Role] : (user.role ? [user.role] : []);
            login(
                email,
                accessToken,
                roles,
                user.FirstName || user.firstName || '',
                user.LastName || user.lastName || ''
            );
            // Navigate ONLY on success — never on error
            navigate('/dashboard');
        } catch (err: any) {
            console.error("Login Error:", err);

            // ─── Handle rate limiting (429) ───
            if (err.response?.status === 429) {
                const retryHeader = err.response?.headers?.['retry-after'];
                const seconds = retryHeader ? parseInt(retryHeader, 10) : 30;
                setRetryAfter(isNaN(seconds) ? 30 : seconds);
                setError(`Too many login attempts. Please wait ${isNaN(seconds) ? 30 : seconds} seconds before trying again.`);
                setLoading(false);
                return; // Do NOT navigate, do NOT clear error
            }

            // ─── Handle all other errors ───
            const data = err.response?.data;
            let msg = '';
            if (typeof data === 'string') {
                msg = data;
            } else if (data?.error) {
                msg = data.error;
            } else if (data?.title) {
                msg = data.title;
            } else if (err.message) {
                msg = err.message;
            } else {
                msg = 'Login failed. Please check your connection and try again.';
            }
            setError(msg);
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
                            Resource Manager
                        </h1>
                        <p className="text-gray-500 mt-2">Welcome back! Please sign in.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <input
                                    id="login-email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <input
                                    id="login-password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder="Your secure password"
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
                                    aria-label="Dismiss error"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {/* Rate-limit countdown */}
                        {isRateLimited && (
                            <div className="text-center text-amber-600 text-sm font-medium animate-pulse">
                                Retry available in {retryAfter}s
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
                                        <span>Signing In...</span>
                                    </>
                                ) : isRateLimited ? (
                                    <>
                                        <Clock className="h-5 w-5" />
                                        <span>Please Wait ({retryAfter}s)</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Sign In</span>
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </div>
                        </button>
                    </form>
                </div>
                <div className="px-8 py-4 bg-gray-50 border-t border-gray-100/50 text-center">
                    <p className="text-sm text-gray-500">
                        Don't have an account? <span onClick={() => navigate('/signup')} className="text-[#065F46] font-semibold cursor-pointer hover:underline">Create Account</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
