import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_TIMEOUT } from './config';

// Storage keys
const STORAGE_KEYS = {
  TOKEN: '@auth_token',
  REFRESH_TOKEN: '@refresh_token',
  USER: '@user_data',
};

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
  const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
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
        const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

        if (refreshToken) {
          // Attempt to refresh token
          const response = await apiClient.post('/auth/refresh', {
            refreshToken,
          });

          const newToken = response.data.token;
          const newRefreshToken = response.data.refreshToken;

          // Store new tokens
          await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
          await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);

          // Retry original request
          originalRequest._retry = true;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.REFRESH_TOKEN, STORAGE_KEYS.USER]);
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

// Auth API functions
export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    try {
      console.log('[AUTH] Attempting login to:', API_BASE_URL + '/auth/login');
      const response = await apiClient.post<any>('/auth/login', data);
      const raw = response.data;
      console.log('[AUTH] Raw response:', JSON.stringify(raw));

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

      console.log('[AUTH] Mapped user:', JSON.stringify(user));

      // Store tokens and user data
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
      if (refreshToken) {
        await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

      return { token, refreshToken, user };
    } catch (error) {
      const axiosError = error as AxiosError<AuthError>;
      console.error('[AUTH] Login error status:', axiosError.response?.status);
      console.error('[AUTH] Login error data:', JSON.stringify(axiosError.response?.data));
      console.error('[AUTH] Network error message:', axiosError.message);
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
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER,
    ]);
  },

  getToken: async (): Promise<string | null> => {
    return await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  },

  getUser: async () => {
    const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    return !!token;
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
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
      if (refreshToken) await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
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
