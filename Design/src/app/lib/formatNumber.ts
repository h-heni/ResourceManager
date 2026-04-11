import { getCurrencySymbol, DEFAULT_CURRENCY } from './currencyUtils';

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCurrency(
  amount: number,
  currency?: string,
  locale: string = 'en-US'
): string {
  const currencyCode = currency || DEFAULT_CURRENCY;
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  } catch {
    // Fallback if currency code is invalid
    const symbol = getCurrencySymbol(currencyCode);
    return `${symbol}${formatNumber(amount)}`;
  }
}
