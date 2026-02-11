import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { getErrorStatus } from '../utils/errorUtils';

// Use environment variable for API URL.
// In production the frontend is served by nginx which reverse-proxies /api
// to the backend container, so we use a relative URL (empty string).
// In development Vite's proxy handles /api → https://localhost:7175.
const API_URL = import.meta.env.VITE_API_URL ?? '';

// ═══════════════════════════════════════════════════════════════
// IN-MEMORY TOKEN STORE — Never stored in localStorage (XSS-safe)
// ═══════════════════════════════════════════════════════════════
let accessToken: string | null = null;
let isRefreshing = false;
let isLoggingOut = false;  // Guard: prevents interceptor from redirecting during logout
let failedQueue: Array<{
    resolve: (token: string | null) => void;
    reject: (error: unknown) => void;
}> = [];

export function setAccessToken(token: string | null) {
    accessToken = token;
}

export function getAccessToken(): string | null {
    return accessToken;
}

/** Mark the app as logging out — interceptor will not redirect or refresh */
export function setLoggingOut(value: boolean) {
    isLoggingOut = value;
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
    baseURL: `${API_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Send HttpOnly refresh token cookie
});

// Request Interceptor: Attach in-memory access token
api.interceptors.request.use(
    (config) => {
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ═══════════════════════════════════════════════════════════════
// Auth endpoints that should NEVER trigger auto-refresh.
// If login returns 401, we want the error to reach the login form,
// NOT get swallowed by a refresh attempt that then redirects.
// ═══════════════════════════════════════════════════════════════
const AUTH_ENDPOINTS = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout'];

function isAuthEndpoint(url: string | undefined): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    return AUTH_ENDPOINTS.some(ep => lower.includes(ep));
}

// Response Interceptor: Auto-refresh on 401 (skips auth endpoints)
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // ─── If we're logging out, don't intercept anything ───
        if (isLoggingOut) {
            return Promise.reject(error);
        }

        // ─── CRITICAL: Never intercept auth endpoints ───
        // Login 401 = wrong credentials → user needs to see the error.
        // Refresh 401 = expired session → handled below separately.
        if (isAuthEndpoint(originalRequest?.url)) {
            return Promise.reject(error);
        }

        // If 429 (rate limited), reject immediately with the server's message
        if (error.response?.status === 429) {
            return Promise.reject(error);
        }

        // If 401 and we haven't retried yet, attempt silent refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // Queue this request until the refresh completes
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
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch (refreshError: unknown) {
                processQueue(refreshError, null);

                // Only clear session on REAL auth failures (server explicitly rejected refresh).
                // Network errors, timeouts, 5xx — keep session intact so user isn't kicked out.
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
                    // Dispatch event so AuthContext can handle navigation via React Router
                    // instead of a hard page reload which causes blank-screen flashes
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

export default api;
