import React, { useState, useEffect, useContext, createContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, type LoginRequest, type SignUpRequest } from '../api';
import { biometricAuth, type BiometricsState } from './useBiometrics';

const STORAGE_KEYS = {
  USER: '@user_data',
  TOKEN: '@auth_token',
};

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  accountLocked: boolean;
  lockReason: string | null;
  biometrics: BiometricsState;
  biometricEnabled: boolean;
  login: (data: LoginRequest) => Promise<void>;
  signUp: (data: SignUpRequest) => Promise<void>;
  logout: () => Promise<void>;
  loginWithBiometrics: (promptMessage: string) => Promise<void>;
  enableBiometrics: () => Promise<void>;
  disableBiometrics: () => Promise<void>;
  hasRole: (role: string) => boolean;
  isManager: boolean;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
  setAccountLocked: (locked: boolean, reason?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountLocked, setAccountLockedState] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [biometrics, setBiometrics] = useState<BiometricsState>({ available: false, enrolled: false, type: 'none' });
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  useEffect(() => {
    loadUser();
    loadBiometricState();
  }, []);

  const loadBiometricState = async () => {
    try {
      const [support, enabled] = await Promise.all([
        biometricAuth.checkSupport(),
        biometricAuth.isEnabled(),
      ]);
      setBiometrics(support);
      setBiometricEnabledState(enabled);
    } catch {
      // Non-fatal — biometric simply won't be offered
    }
  };

  const loadUser = async () => {
    try {
      const session = await authApi.validateStoredSession();
      if (session?.user) {
        setUser(session.user as User);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      await AsyncStorage.multiRemove([STORAGE_KEYS.USER, STORAGE_KEYS.TOKEN, '@refresh_token']);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (data: LoginRequest): Promise<void> => {
    const response = await authApi.login(data);
    setUser(response.user as User);
    setAccountLockedState(false);
    setLockReason(null);
    // Refresh biometric state after a successful login so the offer can appear
    await loadBiometricState();
  };

  const signUp = async (data: SignUpRequest): Promise<void> => {
    const response = await authApi.signUp(data);
    setUser(response.user as User);
    setAccountLockedState(false);
    setLockReason(null);
  };

  const logout = async () => {
    try {
      await authApi.logout();
      setUser(null);
      setAccountLockedState(false);
      setLockReason(null);
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  };

  /**
   * Authenticate using the device biometric (Face ID / Fingerprint).
   * On success, validates the stored session — if still valid, the user is set
   * without requiring a password. If the session has expired the user must log
   * in with their password again.
   */
  const loginWithBiometrics = async (promptMessage: string): Promise<void> => {
    const authenticated = await biometricAuth.authenticate(promptMessage);
    if (!authenticated) throw new Error('biometric_cancelled');

    // Try to restore the cached session first (fast path — no network call)
    const session = await authApi.validateStoredSession();
    if (session?.user) {
      setUser(session.user as User);
      setAccountLockedState(false);
      setLockReason(null);
      return;
    }

    // Cached token expired — signal that password login is required
    throw new Error('session_expired');
  };

  const enableBiometrics = async (): Promise<void> => {
    await biometricAuth.setEnabled(true);
    setBiometricEnabledState(true);
  };

  const disableBiometrics = async (): Promise<void> => {
    await biometricAuth.setEnabled(false);
    setBiometricEnabledState(false);
  };

  const setAccountLocked = (locked: boolean, reason?: string) => {
    setAccountLockedState(locked);
    setLockReason(reason || null);
  };

  const hasRole = (role: string): boolean => {
    return user?.roles?.includes(role) || false;
  };

  const isManager = hasRole('Manager') || hasRole('SuperAdmin');
  const isAdmin = hasRole('SuperAdmin');

  return (
    <AuthContext.Provider value={{
      user, loading, isAuthenticated: !!user, accountLocked, lockReason,
      biometrics, biometricEnabled,
      login, signUp, logout, loginWithBiometrics, enableBiometrics, disableBiometrics,
      hasRole, isManager, isAdmin, refreshUser: loadUser, setAccountLocked,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
