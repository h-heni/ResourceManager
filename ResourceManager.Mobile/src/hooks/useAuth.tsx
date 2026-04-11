import React, { useState, useEffect, useContext, createContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, type LoginRequest, type SignUpRequest } from '../api';

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
  login: (data: LoginRequest) => Promise<void>;
  signUp: (data: SignUpRequest) => Promise<void>;
  logout: () => Promise<void>;
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

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const [userStr, token] = await AsyncStorage.multiGet([STORAGE_KEYS.USER, STORAGE_KEYS.TOKEN]);
      if (userStr[1] && token[1]) {
        setUser(JSON.parse(userStr[1]));
      } else {
        await AsyncStorage.multiRemove([STORAGE_KEYS.USER, STORAGE_KEYS.TOKEN, '@refresh_token']);
        setUser(null);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (data: LoginRequest): Promise<void> => {
    const response = await authApi.login(data);
    setUser(response.user as User);
    setAccountLockedState(false);
    setLockReason(null);
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
      login, signUp, logout, hasRole, isManager, isAdmin, refreshUser: loadUser, setAccountLocked,
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
