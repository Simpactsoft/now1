/**
 * Formatting Utilities for the NOW System
 *
 * RULE-03: No hardcoded currency symbols ($, ₪, €) anywhere in frontend.
 * All currency formatting must go through formatCurrency().
 */

/**
 * Format a monetary amount with proper currency symbol and locale.
 *
 * @param amount  - The numeric value to format
 * @param currency - ISO 4217 currency code (e.g., 'USD', 'ILS', 'EUR')
 * @param locale  - BCP 47 locale string (e.g., 'en-US', 'he-IL')
 * @returns Formatted string like "$1,234.50" or "1,234.50 ₪"
 *
 * @example
 * formatCurrency(1234.5, 'USD', 'en-US')  // → "$1,234.50"
 * formatCurrency(1234.5, 'ILS', 'he-IL')  // → "‏1,234.50 ₪"
 * formatCurrency(1234.5, 'EUR', 'de-DE')  // → "1.234,50 €"
 * formatCurrency(0, 'JPY', 'ja-JP')       // → "￥0"
 */
export function formatCurrency(
    amount: number,
    currency: string = 'USD',
    locale: string = 'en-US'
): string {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: currency === 'JPY' ? 0 : 2,
            maximumFractionDigits: currency === 'JPY' ? 0 : 2,
        }).format(amount);
    } catch {
        // Fallback if currency code is invalid
        return `${currency} ${amount.toFixed(2)}`;
    }
}

/**
 * Format a number with locale-specific grouping and decimals.
 * Use for quantities, percentages, and non-monetary numbers.
 *
 * @param value   - The numeric value to format
 * @param locale  - BCP 47 locale string
 * @param options - Additional Intl.NumberFormat options
 *
 * @example
 * formatNumber(1234.567, 'en-US')          // → "1,234.567"
 * formatNumber(1234.567, 'he-IL')          // → "1,234.567"
 * formatNumber(0.175, 'en-US', { style: 'percent' }) // → "17.5%"
 */
export function formatNumber(
    value: number,
    locale: string = 'en-US',
    options?: Intl.NumberFormatOptions
): string {
    try {
        return new Intl.NumberFormat(locale, options).format(value);
    } catch {
        return value.toString();
    }
}

/**
 * Format a percentage value.
 *
 * @param value  - The decimal value (e.g., 0.17 for 17%)
 * @param locale - BCP 47 locale string
 * @param decimals - Number of decimal places (default: 1)
 *
 * @example
 * formatPercent(0.17, 'en-US')    // → "17.0%"
 * formatPercent(0.055, 'he-IL')   // → "5.5%"
 */
export function formatPercent(
    value: number,
    locale: string = 'en-US',
    decimals: number = 1
): string {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'percent',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(value);
    } catch {
        return `${(value * 100).toFixed(decimals)}%`;
    }
}

/**
 * Get the currency symbol for a given currency code.
 * Useful for input field prefixes where full formatting isn't needed.
 *
 * @example
 * getCurrencySymbol('USD')  // → "$"
 * getCurrencySymbol('ILS')  // → "₪"
 * getCurrencySymbol('EUR')  // → "€"
 */
export function getCurrencySymbol(
    currency: string = 'USD',
    locale: string = 'en-US'
): string {
    try {
        const parts = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
        }).formatToParts(0);

        const symbolPart = parts.find(p => p.type === 'currency');
        return symbolPart?.value || currency;
    } catch {
        return currency;
    }
}
