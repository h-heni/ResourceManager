import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { Lock, Mail, ArrowRight, Loader } from 'lucide-react';
import api from '../services/api';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

// Google Client ID - Replace with your actual Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: any) => void;
                    renderButton: (element: HTMLElement, config: any) => void;
                    prompt: () => void;
                    disableAutoSelect: () => void;
                    revoke: (email: string, callback: () => void) => void;
                };
            };
        };
    }
}

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [auth0Loading, setAuth0Loading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const { login } = useAuth();
    const { 
        loginWithRedirect, 
        isAuthenticated: auth0IsAuthenticated, 
        user: auth0User, 
        getAccessTokenSilently,
        isLoading: auth0IsLoading 
    } = useAuth0();

    // Handle Auth0 callback - when user returns from Auth0 login
    useEffect(() => {
        const handleAuth0Callback = async () => {
            if (auth0IsAuthenticated && auth0User && !auth0Loading) {
                setAuth0Loading(true);
                setError('');
                try {
                    // Get Auth0 access token
                    const accessToken = await getAccessTokenSilently();
                    
                    // Exchange Auth0 token for our JWT
                    const res = await api.post('/Auth/auth0/token-exchange', {
                        accessToken,
                        email: auth0User.email,
                        name: auth0User.name
                    });
                    
                    const { accessToken: jwtToken, user, needsCompanySetup } = res.data;

                    const roles = user.Role ? [user.Role] : (user.role ? [user.role] : []);
                    login(
                        user.Email || user.email || auth0User.email, 
                        jwtToken, 
                        roles,
                        user.FirstName || user.firstName || '',
                        user.LastName || user.lastName || ''
                    );

                    if (needsCompanySetup) {
                        localStorage.setItem('needsCompanySetup', 'true');
                        navigate('/company-setup');
                    } else {
                        navigate('/dashboard');
                    }
                } catch (err: any) {
                    console.error("Auth0 Token Exchange Error:", err);
                    const msg = err.response?.data || "Auth0 login failed.";
                    setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
                } finally {
                    setAuth0Loading(false);
                }
            }
        };

        handleAuth0Callback();
    }, [auth0IsAuthenticated, auth0User, getAccessTokenSilently, login, navigate, auth0Loading]);

    // Initialize Google Sign-In (skip if client ID is not configured)
    useEffect(() => {
        if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') return;

        // Load Google Identity Services script
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initializeGoogleSignIn;
        document.body.appendChild(script);

        return () => {
            // Only remove if the script element still exists and is a child
            if (script.parentNode === document.body) {
                document.body.removeChild(script);
            }
        };
    }, []);

    const initializeGoogleSignIn = () => {
        if (window.google && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID') {
            try {
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleGoogleCallback,
                });

                const buttonDiv = document.getElementById('google-signin-button');
                if (buttonDiv) {
                    window.google.accounts.id.renderButton(buttonDiv, {
                        theme: 'outline',
                        size: 'large',
                        width: '100%',
                        text: 'signin_with',
                    });
                }
            } catch (err) {
                // Catch "origin not allowed for client ID" and similar Google GSI errors
                console.warn('Google Sign-In initialization failed:', err);
            }
        }
    };

    const handleGoogleCallback = async (response: any) => {
        setGoogleLoading(true);
        setError('');
        try {
            const res = await api.post('/Auth/google-login', { idToken: response.credential });
            const { accessToken, user, needsCompanySetup } = res.data;

            if (!accessToken) {
                throw new Error("Invalid token received from server");
            }

            const roles = user.Role ? [user.Role] : (user.role ? [user.role] : []);
            login(
                user.Email || user.email, 
                accessToken, 
                roles,
                user.FirstName || user.firstName || '',
                user.LastName || user.lastName || ''
            );

            if (needsCompanySetup) {
                localStorage.setItem('needsCompanySetup', 'true');
                navigate('/company-setup');
            } else {
                navigate('/dashboard');
            }
        } catch (err: any) {
            console.error("Google Login Error:", err);
            const msg = err.response?.data || "Google login failed.";
            setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleManualGoogleLogin = () => {
        if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
            alert("Google Sign-In requires a valid Client ID.\n\nTo enable:\n1. Go to Google Cloud Console\n2. Create OAuth 2.0 credentials\n3. Set VITE_GOOGLE_CLIENT_ID in your .env file");
            return;
        }
        try {
            if (window.google) {
                window.google.accounts.id.prompt();
            }
        } catch (err) {
            console.warn('Google Sign-In prompt failed:', err);
            setError('Google Sign-In is not available. Check your Google Cloud Console Authorized Origins.');
        }
    };

    const handleAuth0Login = async () => {
        try {
            await loginWithRedirect({
                appState: { returnTo: '/dashboard' }
            });
        } catch (err) {
            console.error('Auth0 login failed:', err);
            setError('Auth0 login failed. Please try again.');
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('/Auth/login', { email, password });
            const { accessToken, user } = response.data;

            if (!accessToken) {
                throw new Error("Invalid token received from server");
            }

            const roles = user.Role ? [user.Role] : (user.role ? [user.role] : []);
            login(
                email, 
                accessToken, 
                roles,
                user.FirstName || user.firstName || '',
                user.LastName || user.lastName || ''
            );
            navigate('/dashboard');
        } catch (err: any) {
            console.error("Login Error:", err);
            const msg = err.response?.data?.error || err.response?.data || "Login failed. Check your connection.";
            setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        } finally {
            setLoading(false);
        }
    };

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
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#065F46] focus:border-transparent transition-all outline-none bg-gray-50/50 focus:bg-white"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center animate-slide-up">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={cn(
                                "w-full py-3 px-4 rounded-xl text-white font-semibold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]",
                                "bg-[#065F46] hover:bg-[#047857]",
                                loading && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <div className="flex items-center justify-center space-x-2">
                                {loading ? (
                                    <>
                                        <Loader className="animate-spin h-5 w-5" />
                                        <span>Signing In...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Sign In</span>
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </div>
                        </button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-200" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500">Or continue with</span>
                            </div>
                        </div>

                        {/* Google Sign-In Button - Rendered by Google SDK if available */}
                        <div id="google-signin-button" className="flex justify-center"></div>

                        {/* Fallback button if Google SDK not loaded */}
                        {(!window.google || GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') && (
                            <button
                                type="button"
                                onClick={handleManualGoogleLogin}
                                disabled={googleLoading}
                                className="w-full py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:border-[#065F46] hover:bg-[#065F46]/5 transition-all flex items-center justify-center space-x-2"
                            >
                                {googleLoading ? (
                                    <Loader className="animate-spin h-5 w-5" />
                                ) : (
                                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                                        <path
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            fill="#4285F4"
                                        />
                                        <path
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            fill="#34A853"
                                        />
                                        <path
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"
                                            fill="#FBBC05"
                                        />
                                        <path
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            fill="#EA4335"
                                        />
                                    </svg>
                                )}
                                <span>Sign in with Google</span>
                            </button>
                        )}

                        {/* Auth0 Login Button */}
                        <button
                            type="button"
                            onClick={handleAuth0Login}
                            disabled={auth0IsLoading || auth0Loading}
                            className="w-full py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:border-orange-500 hover:bg-orange-50 transition-all flex items-center justify-center space-x-2"
                        >
                            {(auth0IsLoading || auth0Loading) ? (
                                <Loader className="animate-spin h-5 w-5" />
                            ) : (
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                                    <path
                                        d="M21.98 7.448L19.62 0H4.347L2.02 7.448c-1.352 4.312.03 9.206 3.815 12.015L12.007 24l6.157-4.552c3.755-2.81 5.182-7.688 3.815-12.015l-6.16 4.58 2.343 7.45-6.157-4.597-6.158 4.58 2.358-7.433-6.188-4.55 7.63-.045L12.008 0l2.356 7.404 7.615.044z"
                                        fill="#EB5424"
                                    />
                                </svg>
                            )}
                            <span>{auth0Loading ? 'Completing Sign In...' : 'Sign in with Auth0'}</span>
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
