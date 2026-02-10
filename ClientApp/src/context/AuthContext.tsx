import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAccessToken } from '../services/api';
import api from '../services/api';
import { setAppLanguage } from '../i18n/index';

interface User {
    email: string;
    roles: string[];
    firstName: string;
    lastName: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, token: string, roles: string[], firstName?: string, lastName?: string) => void;
    logout: () => void;
    loading: boolean;
    displayName: string;
    isManager: boolean;
    isEmployee: boolean;
    isSuperAdmin: boolean;
    canManageUsers: boolean;
    canManageSettings: boolean;
    canCreateInvoices: boolean;
    canDeleteInvoices: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Fetch company language from backend and apply it
    const syncLanguageFromSettings = useCallback(async () => {
        try {
            const res = await api.get('/Settings');
            const lang = res.data?.invoiceLanguage;
            if (lang) setAppLanguage(lang);
        } catch {
            // Non-critical — keep whatever language is persisted
        }
    }, []);

    // On mount: try to restore session via silent refresh
    useEffect(() => {
        const restoreSession = async () => {
            // Check if we have saved user metadata (non-secret info)
            const savedEmail = localStorage.getItem('user_email');
            if (!savedEmail) {
                setLoading(false);
                return;
            }

            try {
                // Attempt silent refresh — the HttpOnly cookie will be sent automatically
                const response = await api.post('/auth/refresh');
                const { accessToken: newToken } = response.data;
                setAccessToken(newToken);

                const savedRoles = localStorage.getItem('user_roles');
                const savedFirstName = localStorage.getItem('user_firstName');
                const savedLastName = localStorage.getItem('user_lastName');

                setUser({
                    email: savedEmail,
                    roles: savedRoles ? JSON.parse(savedRoles) : [],
                    firstName: savedFirstName || '',
                    lastName: savedLastName || ''
                });

                // Sync language from company settings (authoritative source)
                syncLanguageFromSettings();
            } catch {
                // Refresh failed — session expired, clear local data
                localStorage.removeItem('user_email');
                localStorage.removeItem('user_roles');
                localStorage.removeItem('user_firstName');
                localStorage.removeItem('user_lastName');
                setAccessToken(null);
            }
            setLoading(false);
        };

        restoreSession();
    }, []);

    const login = useCallback((email: string, token: string, roles: string[], firstName?: string, lastName?: string) => {
        // Store access token in memory only (XSS-safe)
        setAccessToken(token);

        // Store non-secret user metadata in localStorage for session restoration
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_roles', JSON.stringify(roles));
        localStorage.setItem('user_firstName', firstName || '');
        localStorage.setItem('user_lastName', lastName || '');

        setUser({ email, roles, firstName: firstName || '', lastName: lastName || '' });

        // Sync language from company settings after login
        syncLanguageFromSettings();

        navigate('/dashboard');
    }, [navigate, syncLanguageFromSettings]);

    const logout = useCallback(async () => {
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
        setUser(null);
        navigate('/login');
    }, [navigate]);

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
            loading, 
            displayName,
            isManager,
            isEmployee,
            isSuperAdmin,
            canManageUsers,
            canManageSettings,
            canCreateInvoices,
            canDeleteInvoices
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
