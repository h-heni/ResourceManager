import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    /** Show real-time strength checklist beneath the input */
    showChecklist?: boolean;
    /** i18n labels for the checklist items (pass from caller via t()) */
    checklistLabels?: {
        length?: string;
        uppercase?: string;
        number?: string;
        special?: string;
    };
}

const defaultLabels = {
    length: 'At least 6 characters',
    uppercase: 'One uppercase letter',
    number: 'One number',
    special: 'One special character',
};

/**
 * Password input with visibility toggle and optional real-time checklist.
 */
export default function PasswordInput({
    showChecklist = false,
    checklistLabels,
    className,
    value,
    ...rest
}: PasswordInputProps) {
    const [visible, setVisible] = useState(false);
    const labels = { ...defaultLabels, ...checklistLabels };
    const pw = typeof value === 'string' ? value : '';

    const checks = [
        { key: 'length',    pass: pw.length >= 6,            label: labels.length },
        { key: 'uppercase', pass: /[A-Z]/.test(pw),          label: labels.uppercase },
        { key: 'number',    pass: /\d/.test(pw),             label: labels.number },
        { key: 'special',   pass: /[^A-Za-z0-9]/.test(pw),  label: labels.special },
    ];

    return (
        <div>
            <div className="relative">
                <Lock className="absolute start-3 top-3 h-5 w-5 text-gray-400 pointer-events-none" />
                <input
                    {...rest}
                    type={visible ? 'text' : 'password'}
                    value={value}
                    className={cn(
                        'w-full ps-10 pe-10 py-3 border border-gray-200 rounded-xl',
                        'focus:ring-2 focus:ring-[#065F46] focus:border-transparent',
                        'transition-all outline-none bg-gray-50/50 focus:bg-white',
                        className,
                    )}
                />
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setVisible(v => !v)}
                    className="absolute end-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={visible ? 'Hide password' : 'Show password'}
                >
                    {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
            </div>

            {showChecklist && pw.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                    {checks.map(c => (
                        <li
                            key={c.key}
                            className={cn(
                                'flex items-center gap-1.5 transition-colors',
                                c.pass ? 'text-emerald-600' : 'text-gray-400',
                            )}
                        >
                            <span className={cn(
                                'inline-block size-1.5 rounded-full',
                                c.pass ? 'bg-emerald-500' : 'bg-gray-300',
                            )} />
                            {c.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
