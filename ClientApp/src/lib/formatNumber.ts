/**
 * Format a number with space as thousands separator and comma as decimal separator.
 * Examples:
 *   formatNumber(12345.67)     → "12 345,67"
 *   formatNumber(12345.678, 3) → "12 345,678"
 *   formatNumber(0)            → "0,00"
 *   formatNumber(1000)         → "1 000,00"
 */
export function formatNumber(value: number | null | undefined, decimals = 3): string {
    if (value == null || isNaN(value)) return '0' + ',' + '0'.repeat(decimals);

    const fixed = Math.abs(value).toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');

    // Add space as thousands separator
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    const sign = value < 0 ? '-' : '';
    return `${sign}${formatted},${decPart}`;
}

/**
 * Shorthand: format with currency symbol appended.
 * Example: formatCurrency(12345.67, 'TND') → "12 345,670 TND"
 */
export function formatCurrency(
    value: number | null | undefined,
    currency: string,
    decimals = 3
): string {
    return `${formatNumber(value, decimals)} ${currency}`;
}
