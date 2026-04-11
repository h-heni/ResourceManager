import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { INVOICE_STATUS } from './constants';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Tailwind classes for invoice/payment status badges. */
export function getInvoiceStatusColor(status: string): string {
    switch (status) {
        case INVOICE_STATUS.PAID: return 'bg-emerald-100 text-emerald-700';
        case INVOICE_STATUS.PARTIALLY_PAID: return 'bg-blue-100 text-blue-700';
        case INVOICE_STATUS.PENDING: return 'bg-amber-100 text-amber-700';
        case INVOICE_STATUS.ARCHIVED: return 'bg-slate-100 text-slate-700';
        default: return 'bg-gray-100 text-gray-700';
    }
}
