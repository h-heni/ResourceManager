// Error handling utilities
export class AppError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'AppError';
  }
}

export function getErrorMessage(error: unknown, defaultMessage = 'An error occurred'): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error instanceof AppError) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return (error as any).message;
  }

  return defaultMessage;
}

export function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('offline')
  );
}

export function isAuthError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('authentication')
  );
}
