// Formatting utilities
import { theme } from '../theme';

export function formatCurrency(
  amount: number,
  currencySymbol = 'TND'
): string {
  return `${amount.toLocaleString()} ${currencySymbol}`;
}

export function formatCurrencyCompact(
  amount: number,
  currencySymbol = 'TND'
): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M ${currencySymbol}`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K ${currencySymbol}`;
  }
  return `${amount.toLocaleString()} ${currencySymbol}`;
}

export function formatDate(dateString: string, format = 'short'): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {};

  switch (format) {
    case 'short':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    case 'long':
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'time':
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    default:
      return date.toLocaleDateString();
  }
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Format as +XXX XX XX XX XX
  if (cleaned.length >= 10) {
    const match = cleaned.match(/(\d{1,3})(\d{2})(\d{2})(\d{2})/);
    if (match) {
      return `+${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }
  }

  // Return original if can't format
  return phone;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

export function capitalizeFirst(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    Paid: theme.colors.success,
    PartiallyPaid: theme.colors.warning,
    Pending: theme.colors.warning,
    Overdue: theme.colors.error,
    Draft: theme.colors.text.tertiary,
    Archived: theme.colors.text.light,
  };

  return colorMap[status] || theme.colors.text.tertiary;
}
