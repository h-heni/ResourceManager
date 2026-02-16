import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

export type InlineMessageVariant = 'success' | 'error' | 'warning' | 'info';

interface InlineMessageProps {
    /** Which visual style to use */
    variant: InlineMessageVariant;
    /** Main message text (supports JSX too) */
    children: React.ReactNode;
    /** Optional title above the message body */
    title?: string;
    /** If provided, renders a dismiss "X" button */
    onDismiss?: () => void;
    /** Extra Tailwind classes */
    className?: string;
}

const config: Record<InlineMessageVariant, {
    icon: typeof AlertCircle;
    bg: string;
    border: string;
    text: string;
    iconColor: string;
    dismissHover: string;
}> = {
    success: {
        icon: CheckCircle2,
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-800',
        iconColor: 'text-emerald-500',
        dismissHover: 'hover:bg-emerald-100',
    },
    error: {
        icon: AlertCircle,
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        iconColor: 'text-red-500',
        dismissHover: 'hover:bg-red-100',
    },
    warning: {
        icon: AlertTriangle,
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-800',
        iconColor: 'text-amber-500',
        dismissHover: 'hover:bg-amber-100',
    },
    info: {
        icon: Info,
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        iconColor: 'text-blue-500',
        dismissHover: 'hover:bg-blue-100',
    },
};

/**
 * Professional inline alert that replaces toasts / window.alert().
 * Shows contextually in the form / section where the action happened.
 */
export default function InlineMessage({
    variant,
    children,
    title,
    onDismiss,
    className,
}: InlineMessageProps) {
    const c = config[variant];
    const Icon = c.icon;

    return (
        <div
            role="alert"
            className={cn(
                'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-in',
                c.bg, c.border, c.text,
                className,
            )}
        >
            <Icon className={cn('size-5 shrink-0 mt-0.5', c.iconColor)} />
            <div className="flex-1 min-w-0">
                {title && <p className="font-semibold mb-0.5">{title}</p>}
                <div>{children}</div>
            </div>
            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    className={cn('shrink-0 p-0.5 rounded-lg transition-colors', c.dismissHover)}
                    aria-label="Dismiss"
                >
                    <X className="size-4" />
                </button>
            )}
        </div>
    );
}
