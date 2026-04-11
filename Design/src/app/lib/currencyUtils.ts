export const DEFAULT_CURRENCY = 'USD';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'CHF',
  CNY: '¥',
  SEK: 'kr',
  NZD: 'NZ$',
  TND: 'TND',
  MAD: 'MAD',
  SAR: 'SAR',
  AED: 'AED',
  QAR: 'QAR',
  KWD: 'KWD',
  BHD: 'BHD',
  OMR: 'OMR',
  EGP: 'EGP',
  DZD: 'DZD',
  LYD: 'LYD',
};

export const CHART_COLORS = {
  revenue:      '#4F46E5', // indigo-600
  revenueTo:    '#818CF8', // indigo-400 (gradient end)
  expenses:     '#F43F5E', // rose-500
  expensesTo:   '#FDA4AF', // rose-300 (gradient end)
  net:          '#059669', // emerald-600
  paid:         '#10B981', // emerald-500
  partial:      '#3B82F6', // blue-500
  unpaid:       '#F59E0B', // amber-500
  draft:        '#9CA3AF', // gray-400
  overdue:      '#EF4444', // red-500
  supplier:     '#8B5CF6', // purple-500
  growth:       '#06B6D4', // cyan-500
} as const;

export function getCurrencySymbol(currency?: string): string {
  if (!currency) return CURRENCY_SYMBOLS[DEFAULT_CURRENCY];
  return CURRENCY_SYMBOLS[currency] || currency;
}

export const CURRENCY_OPTIONS = Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => ({
  code,
  symbol,
  label: `${symbol} - ${code}`,
}));

export const CURRENCY_SYMBOL_MAP = CURRENCY_SYMBOLS;