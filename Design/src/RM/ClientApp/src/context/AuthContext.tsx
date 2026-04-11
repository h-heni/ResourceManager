/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAccessToken, setLoggingOut, broadcastLogout } from '../services/api';
import api from '../services/api';

interface User {
    email: string;
    roles: string[];
    firstName: string;
    lastName: string;
    isProfileComplete: boolean;
    baseStoragePath?: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, token: string, roles: string[], firstName?: string, lastName?: string, isProfileComplete?: boolean, baseStoragePath?: string) => void;
    logout: () => void;
    updateProfileComplete: (isProfileComplete: boolean, baseStoragePath?: string) => void;
    loading: boolean;
    displayName: string;
    isManager: boolean;
    isEmployee: boolean;
    isSuperAdmin: boolean;
    canManageUsers: boolean;
    canManageSettings: boolean;
    canCreateInvoices: boolean;
    canDeleteInvoices: boolean;
    accountLocked: { reason: 'suspended' | 'expired'; expiryDate?: string } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ──── Synchronous restore: immediately hydrate user from localStorage ────
    // This prevents the "Refresh = Logout" loop by making isAuthenticated=true
    // BEFORE the async refresh runs, so ProtectedRoute never redirects.
    const [user, setUser] = useState<User | null>(() => {
        const savedEmail = localStorage.getItem('user_email');
        if (!savedEmail) return null;
        const savedRoles = localStorage.getItem('user_roles');
        return {
            email: savedEmail,
            roles: savedRoles ? JSON.parse(savedRoles) : [],
            firstName: localStorage.getItem('user_firstName') || '',
            lastName: localStorage.getItem('user_lastName') || '',
            isProfileComplete: localStorage.getItem('user_isProfileComplete') === 'true',
            baseStoragePath: localStorage.getItem('user_baseStoragePath') || undefined,
        };
    });
    // If we have cached user data, skip the loading gate so UI renders immediately.
    // The async refresh below will silently update the token in the background.
    const [loading, setLoading] = useState(() => !localStorage.getItem('user_email'));
    const [accountLocked, setAccountLocked] = useState<{ reason: 'suspended' | 'expired'; expiryDate?: string } | null>(null);
    const navigate = useNavigate();
    const isRestoringRef = useRef(false); // Guard against concurrent restoreSession calls

    // On mount: try to restore session via silent refresh
    useEffect(() => {
        let cancelled = false;

        const restoreSession = async () => {
            // Prevent concurrent restore calls (StrictMode double-mount)
            if (isRestoringRef.current) return;
            isRestoringRef.current = true;

            // Check if we have saved user metadata (non-secret info)
            const savedEmail = localStorage.getItem('user_email');
            if (!savedEmail) {
                setLoading(false);
                isRestoringRef.current = false;
                return;
            }

            try {
                // Attempt silent refresh — the HttpOnly cookie will be sent automatically
                const response = await api.post('/auth/refresh');
                if (cancelled) { isRestoringRef.current = false; return; }

                const { accessToken: newToken } = response.data;
                setAccessToken(newToken);

                // Prefer fresh server data from refresh response, fall back to localStorage
                const serverUser = response.data.user;
                const savedRoles = localStorage.getItem('user_roles');

                const email = serverUser?.email ?? savedEmail;
                const role = serverUser?.role;
                const roles = role ? [role] : (savedRoles ? JSON.parse(savedRoles) : []);
                const firstName = serverUser?.firstName ?? localStorage.getItem('user_firstName') ?? '';
                const lastName = serverUser?.lastName ?? localStorage.getItem('user_lastName') ?? '';
                const isProfileComplete = serverUser?.isProfileComplete ?? localStorage.getItem('user_isProfileComplete') === 'true';
                const baseStoragePath = serverUser?.baseStoragePath ?? localStorage.getItem('user_baseStoragePath');

                // Persist updated values so they survive the next restore
                localStorage.setItem('user_email', email);
                localStorage.setItem('user_roles', JSON.stringify(roles));
                localStorage.setItem('user_firstName', firstName);
                localStorage.setItem('user_lastName', lastName);
                localStorage.setItem('user_isProfileComplete', String(!!isProfileComplete));
                if (baseStoragePath) localStorage.setItem('user_baseStoragePath', baseStoragePath);

                setUser({
                    email,
                    roles,
                    firstName,
                    lastName,
                    isProfileComplete: !!isProfileComplete,
                    baseStoragePath: baseStoragePath || undefined
                });

                // Language sync is handled by DashboardLayout via /Settings/branding
            } catch {
                if (cancelled) { isRestoringRef.current = false; return; }
                // Refresh failed — session expired, clear local data
                localStorage.removeItem('user_email');
                localStorage.removeItem('user_roles');
                localStorage.removeItem('user_firstName');
                localStorage.removeItem('user_lastName');
                localStorage.removeItem('user_isProfileComplete');
                localStorage.removeItem('user_baseStoragePath');
                setAccessToken(null);
            }
            if (!cancelled) setLoading(false);
            isRestoringRef.current = false;
        };

        restoreSession();

        return () => {
            cancelled = true;
            isRestoringRef.current = false; // Reset so StrictMode re-mount can run restoreSession
        };
    }, []);

    // Listen for session-expired events from the api interceptor
    useEffect(() => {
        const handleSessionExpired = () => {
            setAccessToken(null);
            setUser(null);
            setLoading(false);
            navigate('/login', { replace: true });
        };
        window.addEventListener('auth:session-expired', handleSessionExpired);
        return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
    }, [navigate]);

    // Listen for account-locked events from the api interceptor
    useEffect(() => {
        const handleAccountLocked = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            setAccountLocked({ reason: detail.reason, expiryDate: detail.expiryDate });
        };
        window.addEventListener('auth:account-locked', handleAccountLocked);
        return () => window.removeEventListener('auth:account-locked', handleAccountLocked);
    }, []);

    const login = useCallback((email: string, token: string, roles: string[], firstName?: string, lastName?: string, isProfileComplete?: boolean, baseStoragePath?: string) => {
        // Store access token in memory only (XSS-safe)
        // Only update if a non-empty token is provided (avoids overwriting during profile-complete updates)
        if (token) setAccessToken(token);

        // Store non-secret user metadata in localStorage for session restoration
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_roles', JSON.stringify(roles));
        localStorage.setItem('user_firstName', firstName || '');
        localStorage.setItem('user_lastName', lastName || '');
        localStorage.setItem('user_isProfileComplete', String(!!isProfileComplete));
        if (baseStoragePath) localStorage.setItem('user_baseStoragePath', baseStoragePath);

        setUser({
            email,
            roles,
            firstName: firstName || '',
            lastName: lastName || '',
            isProfileComplete: !!isProfileComplete,
            baseStoragePath
        });

        // Clear any stale account-locked state from a previous session
        setAccountLocked(null);

        // Language sync is handled by DashboardLayout via /Settings/branding

        // NOTE: Navigation is handled by the caller (LoginPage, CompanyInitPage, etc.)
        // Do NOT navigate here — it causes double-navigation and race conditions.
    }, []);

    const logout = useCallback(async () => {
        // Set guard FIRST — prevents interceptor from redirecting during logout
        setLoggingOut(true);

        // Dispatch logout event BEFORE clearing state so components can clean up
        window.dispatchEvent(new Event('auth:logout'));

        // Call server to revoke refresh token and clear the cookie
        try {
            await api.post('/auth/logout');
        } catch {
            // Best effort — continue with client-side cleanup
        }

        setAccessToken(null);
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_roles');
        localStorage.removeItem('user_firstName');
        localStorage.removeItem('user_lastName');
        localStorage.removeItem('user_isProfileComplete');
        localStorage.removeItem('user_baseStoragePath');
        sessionStorage.removeItem('company_branding');
        setUser(null);

        // Clear account-locked state so the next user isn't affected
        setAccountLocked(null);

        // Notify other tabs about logout
        broadcastLogout();

        // Reset guard after cleanup
        setLoggingOut(false);

        navigate('/login');
    }, [navigate]);

    /** Update isProfileComplete flag without full login (avoids hard page reload) */
    const updateProfileComplete = useCallback((isProfileComplete: boolean, baseStoragePath?: string) => {
        localStorage.setItem('user_isProfileComplete', String(isProfileComplete));
        if (baseStoragePath) localStorage.setItem('user_baseStoragePath', baseStoragePath);
        setUser(prev => prev ? { ...prev, isProfileComplete, baseStoragePath: baseStoragePath ?? prev.baseStoragePath } : prev);
    }, []);

    // Compute display name: prefer "FirstName LastName", fallback to email
    const displayName = user
        ? (user.firstName || user.lastName
            ? `${user.firstName} ${user.lastName}`.trim()
            : user.email)
        : '';

    // Role-based permission helpers
    const hasRole = (role: string) => user?.roles?.some(r => r.toLowerCase() === role.toLowerCase()) ?? false;

    const isSuperAdmin = hasRole('SuperAdmin');
    const isManager = hasRole('Manager') || isSuperAdmin;
    const isEmployee = hasRole('Employee');

    // Permission flags
    const canManageUsers = isManager; // Manager and SuperAdmin can manage users
    const canManageSettings = isManager; // Manager and SuperAdmin can manage settings
    const canCreateInvoices = isManager || isEmployee; // Both can create
    const canDeleteInvoices = isManager; // Only Manager can delete

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            login,
            logout,
            updateProfileComplete,
            loading,
            displayName,
            isManager,
            isEmployee,
            isSuperAdmin,
            canManageUsers,
            canManageSettings,
            canCreateInvoices,
            canDeleteInvoices,
            accountLocked
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
