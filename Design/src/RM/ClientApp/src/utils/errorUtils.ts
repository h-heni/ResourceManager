import { AxiosError } from 'axios';

/**
 * Extract a user-friendly error message from an unknown caught error.
 * Handles Axios errors (with response body), native Errors, and arbitrary values.
 */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
    if (error instanceof AxiosError) {
        const data = error.response?.data;
        if (typeof data === 'string') return data;
        if (data && typeof data === 'object') {
            if ('message' in data && typeof data.message === 'string') return data.message;
            if ('error' in data && typeof data.error === 'string') return data.error;
            if ('title' in data && typeof data.title === 'string') return data.title;
        }
        return error.message || fallback;
    }
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return fallback;
}

/**
 * Extract the Axios response data from an unknown error, or undefined.
 */
export function getAxiosResponseData(error: unknown): Record<string, unknown> | undefined {
    if (error instanceof AxiosError && error.response?.data && typeof error.response.data === 'object') {
        return error.response.data as Record<string, unknown>;
    }
    return undefined;
}

/**
 * Get the HTTP status code from an error, or undefined.
 */
export function getErrorStatus(error: unknown): number | undefined {
    if (error instanceof AxiosError) return error.response?.status;
    return undefined;
}
