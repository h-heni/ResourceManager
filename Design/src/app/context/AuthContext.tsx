/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { setAccessToken, setLoggingOut, broadcastLogout } from '../services/api';
import api from '../services/api';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { dummyUsers } from '../services/dummyData';

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
  // Dummy data mode: auto-login as Manager
  const [user, setUser] = useState<User | null>(() => {
    if (USE_DUMMY_DATA) {
      const dummyUser = dummyUsers[0]; // Manager
      return {
        email: dummyUser.email,
        roles: [dummyUser.role],
        firstName: dummyUser.firstName,
        lastName: dummyUser.lastName,
        isProfileComplete: true,
        baseStoragePath: '/uploads/company1',
      };
    }
    
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

  const [loading, setLoading] = useState(() => {
    if (USE_DUMMY_DATA) return false;
    return !localStorage.getItem('user_email');
  });
  
  const [accountLocked, setAccountLocked] = useState<{ reason: 'suspended' | 'expired'; expiryDate?: string } | null>(null);
  
  const navigate = useNavigate();
  const isRestoringRef = useRef(false);

  // Session restoration (only for real backend)
  useEffect(() => {
    if (USE_DUMMY_DATA) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const restoreSession = async () => {
      if (isRestoringRef.current) return;
      isRestoringRef.current = true;

      const savedEmail = localStorage.getItem('user_email');
      if (!savedEmail) {
        setLoading(false);
        isRestoringRef.current = false;
        return;
      }

      try {
        const response = await api.post('/auth/refresh');
        if (cancelled) { isRestoringRef.current = false; return; }

        const { accessToken: newToken } = response.data;
        setAccessToken(newToken);

        const serverUser = response.data.user;
        const savedRoles = localStorage.getItem('user_roles');

        const email = serverUser?.email ?? savedEmail;
        const role = serverUser?.role;
        const roles = role ? [role] : (savedRoles ? JSON.parse(savedRoles) : []);
        const firstName = serverUser?.firstName ?? localStorage.getItem('user_firstName') ?? '';
        const lastName = serverUser?.lastName ?? localStorage.getItem('user_lastName') ?? '';
        const isProfileComplete = serverUser?.isProfileComplete ?? localStorage.getItem('user_isProfileComplete') === 'true';
        const baseStoragePath = serverUser?.baseStoragePath ?? localStorage.getItem('user_baseStoragePath');

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
      } catch {
        if (cancelled) { isRestoringRef.current = false; return; }
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
      isRestoringRef.current = false;
    };
  }, []);

  // Listen for session-expired events
  useEffect(() => {
    if (USE_DUMMY_DATA) return;
    
    const handleSessionExpired = () => {
      setAccessToken(null);
      setUser(null);
      setLoading(false);
      if (navigate) navigate('/login', { replace: true });
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [navigate]);

  // Listen for account-locked events
  useEffect(() => {
    if (USE_DUMMY_DATA) return;
    
    const handleAccountLocked = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setAccountLocked({ reason: detail.reason, expiryDate: detail.expiryDate });
    };
    window.addEventListener('auth:account-locked', handleAccountLocked);
    return () => window.removeEventListener('auth:account-locked', handleAccountLocked);
  }, []);

  const login = useCallback((email: string, token: string, roles: string[], firstName?: string, lastName?: string, isProfileComplete?: boolean, baseStoragePath?: string) => {
    if (token && !USE_DUMMY_DATA) setAccessToken(token);

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

    setAccountLocked(null);
  }, []);

  const logout = useCallback(async () => {
    if (USE_DUMMY_DATA) {
      if (navigate) navigate('/login');
      return;
    }

    setLoggingOut(true);
    window.dispatchEvent(new Event('auth:logout'));

    try {
      await api.post('/auth/logout');
    } catch {
      // Best effort
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
    setAccountLocked(null);
    broadcastLogout();
    setLoggingOut(false);

    if (navigate) navigate('/login');
  }, [navigate]);

  const updateProfileComplete = useCallback((isProfileComplete: boolean, baseStoragePath?: string) => {
    localStorage.setItem('user_isProfileComplete', String(isProfileComplete));
    if (baseStoragePath) localStorage.setItem('user_baseStoragePath', baseStoragePath);
    setUser(prev => prev ? { ...prev, isProfileComplete, baseStoragePath: baseStoragePath ?? prev.baseStoragePath } : prev);
  }, []);

  const displayName = user
    ? (user.firstName || user.lastName
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.email)
    : '';

  const hasRole = (role: string) => user?.roles?.some(r => r.toLowerCase() === role.toLowerCase()) ?? false;

  const isSuperAdmin = hasRole('SuperAdmin');
  const isManager = hasRole('Manager') || isSuperAdmin;
  const isEmployee = hasRole('Employee');

  const canManageUsers = isManager;
  const canManageSettings = isManager;
  const canCreateInvoices = isManager || isEmployee;
  const canDeleteInvoices = isManager;

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