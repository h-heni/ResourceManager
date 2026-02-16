/**
 * Locale-aware number and currency formatting.
 *
 * Locale behaviour:
 *   EN: 12,345.670 TND     (comma thousands, period decimal)
 *   FR: 12 345,670 DT      (space thousands, comma decimal)
 *   AR: ١٢٬٣٤٥٫٦٧٠ دت    (Eastern Arabic numerals, Arabic separators)
 *   DE: 12.345,670 TND     (period thousands, comma decimal)
 *
 * When no locale is supplied the functions default to French-style formatting
 * (space thousands, comma decimal) to stay backward-compatible.
 */

import i18n from '../i18n';
import { getLocaleCurrencySymbol } from './currencyUtils';

// ── Intl locale tags used by the browser ──
const INTL_LOCALE_MAP: Record<string, string> = {
    en: 'en-US',
    fr: 'fr-FR',
    ar: 'ar-TN',
    de: 'de-DE',
};

function resolveIntlLocale(locale?: string): string {
    const lang = (locale || i18n.language || 'fr').split('-')[0].toLowerCase();
    return INTL_LOCALE_MAP[lang] || INTL_LOCALE_MAP.fr;
}

/**
 * Format a number using the current (or supplied) locale.
 *
 * @param value    The numeric value (null/undefined → "0…")
 * @param decimals Fractional digits (default 3 for TND / millimes)
 * @param locale   Optional override; otherwise uses the active i18n language
 *
 * @example
 *   formatNumber(12345.67)            → "12 345,670"  (FR default)
 *   formatNumber(12345.67, 3, 'ar')   → "١٢٬٣٤٥٫٦٧٠" (Eastern Arabic)
 *   formatNumber(12345.67, 2, 'en')   → "12,345.67"
 */
export function formatNumber(
    value: number | null | undefined,
    decimals = 3,
    locale?: string
): string {
    const v = value == null || isNaN(value) ? 0 : value;
    const intlLocale = resolveIntlLocale(locale);
    return new Intl.NumberFormat(intlLocale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: true,
    }).format(v);
}

/**
 * Currencies that use 3 decimal places (millimes / fils).
 * All others default to 2.
 */
const THREE_DECIMAL_CURRENCIES = new Set(['TND', 'BHD', 'KWD', 'OMR']);

/** Return the standard number of decimal places for a currency. */
export function getCurrencyDecimals(currency: string): number {
    return THREE_DECIMAL_CURRENCIES.has(currency) ? 3 : 2;
}

/**
 * Format a number with its locale-aware currency symbol.
 *
 * @example
 *   formatCurrency(12345.67, 'TND')           → "12 345,670 DT"   (FR)
 *   formatCurrency(12345.67, 'TND', 3, 'en')  → "12,345.670 TND"  (EN)
 *   formatCurrency(12345.67, 'TND', 3, 'ar')  → "١٢٬٣٤٥٫٦٧٠ دت" (AR)
 */
export function formatCurrency(
    value: number | null | undefined,
    currency: string,
    decimals?: number,
    locale?: string
): string {
    const d = decimals ?? getCurrencyDecimals(currency);
    const lang = (locale || i18n.language || 'fr').split('-')[0].toLowerCase();
    const symbol = getLocaleCurrencySymbol(currency, lang);
    return `${formatNumber(value, d, lang)} ${symbol}`;
}
