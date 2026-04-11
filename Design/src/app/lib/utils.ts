import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInvoiceStatusColor(status: string): string {
  const statusLower = status.toLowerCase();
  switch (statusLower) {
    case 'paid':
    case 'paid_in_full':
      return 'bg-green-100 text-green-800';
    case 'pending':
    case 'unpaid':
      return 'bg-yellow-100 text-yellow-800';
    case 'partially_paid':
    case 'partial':
      return 'bg-blue-100 text-blue-800';
    case 'overdue':
      return 'bg-red-100 text-red-800';
    case 'cancelled':
    case 'canceled':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
