/**
 * Centralized currency configuration and helpers.
 * ALL currency-related logic should reference this file,
 * NOT inline maps or hardcoded 'TND' strings.
 */

/** Fallback currency when none is set. Use this instead of literal 'TND'. */
export const DEFAULT_CURRENCY = 'TND';

/**
 * Chart / visual color tokens — single source of truth for the entire app.
 * Every chart, bar, legend, and status indicator MUST use these.
 */
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

export const CURRENCY_SYMBOL_MAP: Record<string, string> = {
    TND: 'TND',
    USD: '$',
    EUR: '€',
    GBP: '£',
    MAD: 'MAD',
    DZD: 'DZD',
};

export const CURRENCY_OPTIONS = [
    { code: 'TND', symbol: 'TND', label: 'TND - Tunisian Dinar' },
    { code: 'USD', symbol: '$', label: 'USD - US Dollar' },
    { code: 'EUR', symbol: '€', label: 'EUR - Euro' },
    { code: 'GBP', symbol: '£', label: 'GBP - British Pound' },
    { code: 'MAD', symbol: 'MAD', label: 'MAD - Moroccan Dirham' },
    { code: 'DZD', symbol: 'DZD', label: 'DZD - Algerian Dinar' },
] as const;

/**
 * Get display symbol for a currency code.
 * Returns the code itself if not in the map.
 */
export function getCurrencySymbol(code: string): string {
    return CURRENCY_SYMBOL_MAP[code] || code;
}

/**
 * Group amounts by currency. Prevents cross-currency summing.
 *
 * @example
 * const totals = groupByCurrency(
 *   invoices,
 *   inv => inv.totalAmount,
 *   inv => inv.currencySymbol || 'TND'
 * );
 * // { TND: 20000, EUR: 5000 }
 */
export function groupByCurrency<T>(
    items: T[],
    getAmount: (item: T) => number,
    getCurrency: (item: T) => string
): Record<string, number> {
    const result: Record<string, number> = {};
    for (const item of items) {
        const currency = getCurrency(item);
        result[currency] = (result[currency] || 0) + getAmount(item);
    }
    return result;
}

/**
 * Guard: returns true if items have mixed currencies.
 * Use this to warn users or prevent cross-currency operations.
 */
export function hasMixedCurrencies<T>(
    items: T[],
    getCurrency: (item: T) => string
): boolean {
    if (items.length === 0) return false;
    const first = getCurrency(items[0]);
    return items.some(item => getCurrency(item) !== first);
}
