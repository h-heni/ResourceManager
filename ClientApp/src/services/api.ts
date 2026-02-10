import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

// Use environment variable for API URL
const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7175';

// ═══════════════════════════════════════════════════════════════
// IN-MEMORY TOKEN STORE — Never stored in localStorage (XSS-safe)
// ═══════════════════════════════════════════════════════════════
let accessToken: string | null = null;
let isRefreshing = false;
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

// Response Interceptor: Auto-refresh on 401
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

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
            } catch (refreshError) {
                processQueue(refreshError, null);
                setAccessToken(null);
                // Clear user data and redirect to login
                localStorage.removeItem('user_email');
                localStorage.removeItem('user_roles');
                localStorage.removeItem('user_firstName');
                localStorage.removeItem('user_lastName');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
