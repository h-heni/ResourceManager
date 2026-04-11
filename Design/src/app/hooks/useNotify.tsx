import { useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, X, Info } from 'lucide-react';

type NotifyVariant = 'success' | 'error' | 'warning' | 'info';

interface NotificationState {
  variant: NotifyVariant;
  message: string;
}

/**
 * Drop-in replacement for window.alert() and toasts.
 *
 * Usage:
 * ```tsx
 * const { notify, NotifyBanner } = useNotify();
 * // In handler:  notify('error', 'Something went wrong');
 * // In JSX:      <NotifyBanner />
 * ```
 */
export function useNotify() {
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const notify = useCallback((variant: NotifyVariant, message: string) => {
    setNotification({ variant, message });
    if (variant === 'success' || variant === 'info') {
      setTimeout(() => setNotification(prev => (prev?.message === message ? null : prev)), 5000);
    }
  }, []);

  const dismiss = useCallback(() => setNotification(null), []);

  const NotifyBanner = useCallback(() => {
    if (!notification) return null;

    const bgColor = {
      success: 'bg-green-50 border-green-200',
      error: 'bg-red-50 border-red-200',
      warning: 'bg-yellow-50 border-yellow-200',
      info: 'bg-blue-50 border-blue-200',
    }[notification.variant];

    const textColor = {
      success: 'text-green-800',
      error: 'text-red-800',
      warning: 'text-yellow-800',
      info: 'text-blue-800',
    }[notification.variant];

    const Icon = notification.variant === 'success' ? CheckCircle
      : notification.variant === 'info' ? Info
      : AlertTriangle;

    return (
      <div className={`${bgColor} border rounded-lg p-4 mb-4`}>
        <div className="flex items-start gap-3">
          <Icon className={textColor} size={20} />
          <p className={`flex-1 text-sm ${textColor}`}>{notification.message}</p>
          <button
            onClick={dismiss}
            className={`${textColor} hover:opacity-70`}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }, [notification, dismiss]);

  return { notify, dismiss, NotifyBanner } as const;
}
