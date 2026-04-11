import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { USE_DUMMY_DATA } from '../config/useDummyData';
import { getErrorStatus } from '../utils/errorUtils';

const API_URL = import.meta.env.VITE_API_URL ?? '';

// Token store — in-memory only
let accessToken: string | null = null;
let isRefreshing = false;
let isLoggingOut = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}> = [];

// Cross-tab synchronization
let authChannel: BroadcastChannel | null = null;
try {
  // Disable BroadcastChannel in iframe environments to prevent "message port was destroyed" errors
  if (window.self === window.top) {
    authChannel = new BroadcastChannel('resource_manager_auth');
    authChannel.onmessage = (event) => {
      if (event.data.type === 'TOKEN_REFRESHED' && event.data.token) {
        accessToken = event.data.token;
        processQueue(null, event.data.token);
      } else if (event.data.type === 'SESSION_EXPIRED') {
        accessToken = null;
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_roles');
        localStorage.removeItem('user_firstName');
        localStorage.removeItem('user_lastName');
        localStorage.removeItem('user_isProfileComplete');
        localStorage.removeItem('user_baseStoragePath');
        window.dispatchEvent(new Event('auth:session-expired'));
      } else if (event.data.type === 'LOGOUT') {
        accessToken = null;
        window.dispatchEvent(new Event('auth:logout'));
      }
    };
  }
} catch {
  authChannel = null;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setLoggingOut(value: boolean) {
  isLoggingOut = value;
}

export function broadcastLogout() {
  authChannel?.postMessage({ type: 'LOGOUT' });
}

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

const api = axios.create({
  baseURL: USE_DUMMY_DATA ? '/api' : `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: !USE_DUMMY_DATA, // Only send cookies when using real backend
});

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    if (accessToken && !USE_DUMMY_DATA) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const AUTH_ENDPOINTS = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout', '/invitations/validate', '/invitations/complete'];

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return AUTH_ENDPOINTS.some(ep => lower.includes(ep));
}

// Response Interceptor (only active when not using dummy data)
if (!USE_DUMMY_DATA) {
  api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      if (isLoggingOut) {
        return Promise.reject(error);
      }

      if (isAuthEndpoint(originalRequest?.url)) {
        return Promise.reject(error);
      }

      if (error.response?.status === 429) {
        return Promise.reject(error);
      }

      if (error.response?.status === 403) {
        const data = error.response.data as { reason?: string; expiryDate?: string } | undefined;
        if (data?.reason === 'suspended' || data?.reason === 'expired') {
          window.dispatchEvent(new CustomEvent('auth:account-locked', {
            detail: { reason: data.reason, expiryDate: data.expiryDate }
          }));
          return Promise.reject(error);
        }
      }

      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({
              resolve: (token) => {
                if (token) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                resolve(api(originalRequest));
              },
              reject,
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const response = await axios.post(
            `${API_URL}/api/auth/refresh`,
            {},
            { withCredentials: true }
          );
          const newToken = response.data.accessToken;
          setAccessToken(newToken);
          processQueue(null, newToken);
          
          authChannel?.postMessage({ type: 'TOKEN_REFRESHED', token: newToken });
          
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshError: unknown) {
          processQueue(refreshError, null);

          const refreshStatus = getErrorStatus(refreshError);
          const isRealAuthFailure = refreshStatus === 401 || refreshStatus === 403;

          if (isRealAuthFailure && !isLoggingOut) {
            setAccessToken(null);
            localStorage.removeItem('user_email');
            localStorage.removeItem('user_roles');
            localStorage.removeItem('user_firstName');
            localStorage.removeItem('user_lastName');
            localStorage.removeItem('user_isProfileComplete');
            localStorage.removeItem('user_baseStoragePath');
            
            authChannel?.postMessage({ type: 'SESSION_EXPIRED' });
            window.dispatchEvent(new Event('auth:session-expired'));
          }

          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    }
  );
}

export default api;