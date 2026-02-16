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
    EUR: '\u20AC',
    GBP: '\u00A3',
    SAR: 'SAR',
    QAR: 'QAR',
};

/**
 * Locale-aware currency symbol map.
 * EN: TND / SAR / QAR (ISO codes)
 * FR: DT / SAR / QAR
 * AR: \u062F\u062A / \u0631.\u0633 / \u0631.\u0642
 */
const LOCALE_CURRENCY_SYMBOLS: Record<string, Record<string, string>> = {
    en: { TND: 'TND', SAR: 'SAR', QAR: 'QAR' },
    fr: { TND: 'DT',  SAR: 'SAR', QAR: 'QAR' },
    ar: { TND: '\u062F\u062A', SAR: '\u0631.\u0633', QAR: '\u0631.\u0642' },
    de: { TND: 'TND', SAR: 'SAR', QAR: 'QAR' },
};

export const CURRENCY_OPTIONS = [
    { code: 'TND', symbol: 'TND', label: 'TND - Tunisian Dinar' },
    { code: 'USD', symbol: '$', label: 'USD - US Dollar' },
    { code: 'EUR', symbol: '\u20AC', label: 'EUR - Euro' },
    { code: 'GBP', symbol: '\u00A3', label: 'GBP - British Pound' },
    { code: 'SAR', symbol: 'SAR', label: 'SAR - Saudi Riyal' },
    { code: 'QAR', symbol: 'QAR', label: 'QAR - Qatari Riyal' },
] as const;

/**
 * Get display symbol for a currency code (locale-unaware fallback).
 * Returns the code itself if not in the map.
 */
export function getCurrencySymbol(code: string): string {
    return CURRENCY_SYMBOL_MAP[code] || code;
}

/**
 * Get locale-aware currency display symbol.
 * @param code  ISO 4217 currency code (e.g. 'TND')
 * @param locale  Active UI locale (e.g. 'fr', 'ar')
 * @returns Localized symbol: EN \u2192 "TND", FR \u2192 "DT", AR \u2192 "\u062F\u062A"
 */
export function getLocaleCurrencySymbol(code: string, locale: string): string {
    const lang = locale.split('-')[0].toLowerCase();
    const localeMap = LOCALE_CURRENCY_SYMBOLS[lang];
    if (localeMap && localeMap[code]) return localeMap[code];
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
