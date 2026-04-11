import { useState, useCallback } from 'react';
import InlineMessage, { type InlineMessageVariant } from '../components/InlineMessage';

interface NotifyState {
    variant: InlineMessageVariant;
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
    const [state, setState] = useState<NotifyState | null>(null);

    const notify = useCallback((variant: InlineMessageVariant, message: string) => {
        setState({ variant, message });
        // Auto-dismiss success messages after 5s
        if (variant === 'success') {
            setTimeout(() => setState(prev => (prev?.message === message ? null : prev)), 5000);
        }
    }, []);

    const dismiss = useCallback(() => setState(null), []);

    const NotifyBanner = useCallback(() => {
        if (!state) return null;
        return (
            <InlineMessage
                variant={state.variant}
                onDismiss={dismiss}
                className="mb-4"
            >
                {state.message}
            </InlineMessage>
        );
    }, [state, dismiss]);

    return { notify, dismiss, NotifyBanner } as const;
}
