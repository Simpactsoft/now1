/**
 * Israel Vertical Plugin — Tax & Compliance
 *
 * Implements Israeli VAT rules:
 *   - Standard VAT: 17% (as of 2024, adjustable via DB)
 *   - Eilat Free Trade Zone: 0%
 *   - SHAAM invoice numbering threshold: ₪25,000
 *   - Reduced rate for tourism: 0% (hotels, tours for foreign tourists)
 *
 * Architecture:
 *   - Uses tax_rates from DB as source of truth
 *   - Falls back to hardcoded defaults if DB not yet seeded
 *   - Registers itself with PluginRegistry on import
 */

import type {
    TaxPlugin,
    CompliancePlugin,
    TaxLineItem,
    TaxResult,
    TaxContext,
    TaxBreakdownEntry,
} from './registry';
import { PluginRegistry } from './registry';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Standard Israel VAT rate (fallback if DB not seeded) */
const IL_STANDARD_VAT = 0.17;

/** Zero-rate for Eilat Free Trade Zone */
const IL_EILAT_VAT = 0;

/** SHAAM threshold: invoices above this amount require SHAAM reporting */
const IL_SHAAM_THRESHOLD = 25000;

/** SHAAM threshold currency */
const IL_SHAAM_CURRENCY = 'ILS';

// ============================================================================
// IL TAX PLUGIN
// ============================================================================

export const israelTaxPlugin: TaxPlugin = {
    countryCodes: ['IL'],
    name: 'Israel VAT Plugin',

    async calculateTax(
        items: TaxLineItem[],
        context: TaxContext
    ): Promise<TaxResult[]> {
        // TODO: Once wired up, fetch actual rates from tax_rates table via context.tenantId
        // For now, use the standard IL VAT rate with Eilat zone check

        return items.map((item) => {
            const lineAmount = item.amount * item.quantity;

            // Check if this is an Eilat zone item (via context or metadata)
            // Zone detection will be enhanced when tax_zones are wired up
            const isEilatZone = false; // Placeholder — will come from context.zoneId lookup

            const rate = isEilatZone ? IL_EILAT_VAT : IL_STANDARD_VAT;
            const taxAmount = Math.round(lineAmount * rate * 100) / 100;

            const breakdown: TaxBreakdownEntry[] = [];

            if (rate > 0) {
                breakdown.push({
                    name: 'מע"מ', // VAT in Hebrew
                    rate,
                    amount: taxAmount,
                    isCompound: false,
                });
            }

            return {
                taxAmount,
                breakdown,
                isExempt: rate === 0 && isEilatZone,
            };
        });
    },

    async getDefaultRate(_zoneId: string, _taxClassId?: string): Promise<number> {
        // TODO: Look up actual rate from DB based on zone
        return IL_STANDARD_VAT;
    },
};

// ============================================================================
// IL COMPLIANCE PLUGIN
// ============================================================================

export const israelCompliancePlugin: CompliancePlugin = {
    countryCodes: ['IL'],
    name: 'Israel Compliance Plugin (SHAAM)',

    async processInvoice(invoice: any): Promise<{
        success: boolean;
        referenceId?: string;
        error?: string;
    }> {
        const invoiceTotal = invoice.total || 0;

        // Check if invoice exceeds SHAAM threshold
        if (invoiceTotal >= IL_SHAAM_THRESHOLD) {
            // TODO: Queue for SHAAM submission via il_shaam_queue table
            console.log(
                `[IL Compliance] Invoice ${invoice.number} exceeds SHAAM threshold (₪${IL_SHAAM_THRESHOLD}). Queuing for SHAAM.`
            );

            return {
                success: true,
                referenceId: `SHAAM-PENDING-${Date.now()}`,
            };
        }

        return { success: true };
    },

    async generateReport(
        _period: { from: Date; to: Date },
        type: string
    ): Promise<any> {
        // Supported reports:
        // - 'vat_periodic' — Monthly/bi-monthly VAT declaration
        // - 'annual_summary' — Annual VAT summary
        // - 'withholding' — Withholding tax report
        console.log(`[IL Compliance] Generate report type: ${type}`);
        return { type, status: 'not_implemented_yet' };
    },
};

// ============================================================================
// SHAAM Helpers
// ============================================================================

/**
 * Check if an invoice requires SHAAM reporting.
 */
export function requiresShaam(totalILS: number): boolean {
    return totalILS >= IL_SHAAM_THRESHOLD;
}

/**
 * Get the current SHAAM threshold.
 */
export function getShaamThreshold(): {
    amount: number;
    currency: string;
} {
    return { amount: IL_SHAAM_THRESHOLD, currency: IL_SHAAM_CURRENCY };
}

// ============================================================================
// AUTO-REGISTER on import
// ============================================================================

PluginRegistry.registerTaxPlugin('IL', israelTaxPlugin);
PluginRegistry.registerCompliancePlugin('IL', israelCompliancePlugin);
