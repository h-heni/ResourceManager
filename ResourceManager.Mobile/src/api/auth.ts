import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { API_BASE_URL, API_TIMEOUT } from './config';
import { secureStorage } from './secureStorage';

// Storage keys.
// TOKEN + REFRESH_TOKEN are stored in encrypted SecureStore (Keychain / AndroidKeyStore).
// USER (non-secret profile cache) stays in AsyncStorage — it's just display data.
export const STORAGE_KEYS = {
  TOKEN: '@auth_token',
  REFRESH_TOKEN: '@refresh_token',
  USER: '@user_data',
};

// Dev-only logger. In release builds this is a no-op so we never leak tokens or PII
// to logcat / Console.app.
const devLog = (...args: unknown[]) => { if (__DEV__) console.log(...args); };
const devError = (...args: unknown[]) => { if (__DEV__) console.error(...args); };

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
apiClient.interceptors.request.use(async (config) => {
  const token = await secureStorage.getItem(STORAGE_KEYS.TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // If 401 and not already refreshing
    if (error.response?.status === 401 && !originalRequest._retry) {
      try {
        const refreshToken = await secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

        if (refreshToken) {
          // Attempt to refresh token
          const response = await apiClient.post('/auth/refresh', {
            refreshToken,
          });

          const newToken = response.data.token;
          const newRefreshToken = response.data.refreshToken;

          // Store new tokens
          await secureStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
          if (newRefreshToken) {
            await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
          }

          // Retry original request
          originalRequest._retry = true;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        await secureStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
        await AsyncStorage.removeItem(STORAGE_KEYS.USER);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Interfaces
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  companyName: string;
  userEmail: string;
  userPassword: string;
  userFirstName: string;
  userLastName: string;
  defaultCurrency?: string;
  defaultLanguage?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  };
}

export interface AuthError {
  message: string;
  errors?: Record<string, string[]>;
}

const isJwtExpired = (token: string): boolean => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return true;
    }

    const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = typeof atob === 'function'
      ? atob(base64Payload)
      : Buffer.from(base64Payload, 'base64').toString('utf8');
    const payload = JSON.parse(decodedPayload);
    if (!payload?.exp || typeof payload.exp !== 'number') {
      return true;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    // Treat as expired 60 seconds before actual exp to absorb clock skew
    // and avoid races where a token expires mid-request.
    return payload.exp <= nowSeconds + 60;
  } catch {
    return true;
  }
};

// Auth API functions
// Shared helper — used by other axios instances to refresh the access token
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  if (!refreshToken) return null;
  const response = await apiClient.post<{ token?: string; accessToken?: string; refreshToken?: string }>(
    '/auth/refresh',
    { refreshToken },
  );
  const newToken = response.data.token ?? response.data.accessToken ?? '';
  const newRefreshToken = response.data.refreshToken ?? '';
  await secureStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
  if (newRefreshToken) await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
  return newToken;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    try {
      devLog('[AUTH] Attempting login');
      const response = await apiClient.post<any>('/auth/login', data);
      const raw = response.data;
      // NOTE: never log the raw response — it contains the access token.

      // Backend returns 'accessToken' (not 'token') and 'role' (string, not 'roles' array)
      // Map to our internal LoginResponse shape
      const token = raw.accessToken ?? raw.token ?? '';
      const refreshToken = raw.refreshToken ?? ''; // may be empty — sent as HttpOnly cookie
      const rawUser = raw.user ?? raw.User ?? {};
      const user = {
        id: rawUser.id ?? rawUser.Id ?? '',
        email: rawUser.email ?? rawUser.Email ?? '',
        firstName: rawUser.firstName ?? rawUser.FirstName ?? '',
        lastName: rawUser.lastName ?? rawUser.LastName ?? '',
        roles: Array.isArray(rawUser.roles)
          ? rawUser.roles
          : rawUser.role
          ? [rawUser.role]
          : rawUser.Role
          ? [rawUser.Role]
          : [],
      };

      devLog('[AUTH] Login success, user id:', user.id);

      // Store tokens in encrypted SecureStore; user metadata in AsyncStorage.
      await secureStorage.setItem(STORAGE_KEYS.TOKEN, token);
      if (refreshToken) {
        await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

      return { token, refreshToken, user };
    } catch (error) {
      const axiosError = error as AxiosError<AuthError>;
      devError('[AUTH] Login error status:', axiosError.response?.status);
      throw new Error(
        axiosError.response?.data?.message ||
        axiosError.response?.data?.errors?.email?.[0] ||
        (axiosError.response?.data as any)?.error ||
        axiosError.message ||
        'Login failed. Please try again.'
      );
    }
  },

  logout: async (): Promise<void> => {
    // Clear all auth data from storage
    await secureStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  },

  getToken: async (): Promise<string | null> => {
    return await secureStorage.getItem(STORAGE_KEYS.TOKEN);
  },

  getUser: async () => {
    const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await secureStorage.getItem(STORAGE_KEYS.TOKEN);
    return !!token && !isJwtExpired(token);
  },

  validateStoredSession: async (): Promise<{ token: string; user: LoginResponse['user'] } | null> => {
    const storedToken = await secureStorage.getItem(STORAGE_KEYS.TOKEN);
    const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);

    if (!storedToken || !storedUser || isJwtExpired(storedToken)) {
      await secureStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      return null;
    }

    try {
      return { token: storedToken, user: JSON.parse(storedUser) };
    } catch {
      await secureStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      return null;
    }
  },

  signUp: async (data: SignUpRequest): Promise<LoginResponse> => {
    try {
      const response = await apiClient.post<any>('/auth/signup', data);
      const raw = response.data;
      const token = raw.accessToken ?? raw.token ?? '';
      const refreshToken = raw.refreshToken ?? '';
      const rawUser = raw.user ?? raw.User ?? {};
      const user = {
        id: rawUser.id ?? rawUser.Id ?? '',
        email: rawUser.email ?? rawUser.Email ?? '',
        firstName: rawUser.firstName ?? rawUser.FirstName ?? '',
        lastName: rawUser.lastName ?? rawUser.LastName ?? '',
        roles: Array.isArray(rawUser.roles)
          ? rawUser.roles
          : rawUser.role
          ? [rawUser.role]
          : rawUser.Role
          ? [rawUser.Role]
          : [],
      };
      await secureStorage.setItem(STORAGE_KEYS.TOKEN, token);
      if (refreshToken) await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      return { token, refreshToken, user };
    } catch (error) {
      const axiosError = error as AxiosError<AuthError>;
      throw new Error(
        axiosError.response?.data?.message ||
        (axiosError.response?.data as any)?.error ||
        axiosError.message ||
        'Sign up failed. Please try again.'
      );
    }
  },

  forgotPassword: async (data: ForgotPasswordRequest): Promise<{ emailSent: boolean }> => {
    try {
      const response = await apiClient.post('/auth/forgot-password', data);
      return response.data;
    } catch {
      // Always return success to prevent email enumeration
      return { emailSent: true };
    }
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await apiClient.post('/auth/reset-password', data);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<AuthError>;
      throw new Error(
        axiosError.response?.data?.message ||
        (axiosError.response?.data as any)?.error ||
        'Password reset failed. Please try again.'
      );
    }
  },
};

export default authApi;
