import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Tailwind classes for invoice/payment status badges. */
export function getInvoiceStatusColor(status: string): string {
    switch (status) {
        case 'Paid': return 'bg-emerald-100 text-emerald-700';
        case 'PartiallyPaid': return 'bg-blue-100 text-blue-700';
        case 'Unpaid': return 'bg-amber-100 text-amber-700';
        default: return 'bg-gray-100 text-gray-700';
    }
}
