/**
 * Plugin Registry — NOW System
 *
 * Provides typed interfaces for compliance/tax plugins and a registry
 * to dynamically resolve plugins based on tenant.compliance_plugins[].
 *
 * Architecture:
 *   1. TaxPlugin — defines how a specific jurisdiction calculates taxes
 *   2. CompliancePlugin — broader compliance (invoicing, reporting, etc.)
 *   3. PluginRegistry — global singleton that maps country codes to plugins
 *
 * Adding a new jurisdiction:
 *   1. Create src/lib/plugins/[country].ts implementing TaxPlugin
 *   2. Call registerTaxPlugin('[CC]', plugin) in that file
 *   3. Import the file in src/lib/plugins/index.ts
 */

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

export interface TaxLineItem {
    productId: string;
    taxClassId?: string;
    amount: number;
    quantity: number;
}

export interface TaxResult {
    /** Total tax amount for this line item */
    taxAmount: number;
    /** Individual tax components (e.g., VAT, surcharge, municipal) */
    breakdown: TaxBreakdownEntry[];
    /** Whether customer was found exempt */
    isExempt: boolean;
}

export interface TaxBreakdownEntry {
    name: string;       // e.g., "VAT", "Municipal Tax"
    rate: number;       // Decimal, e.g., 0.17
    amount: number;     // Computed tax amount for this component
    isCompound: boolean;
}

export interface TaxContext {
    tenantId: string;
    customerId?: string;
    zoneId?: string;
    currency: string;
    date: Date;
}

export interface TaxPlugin {
    /** Country code(s) this plugin handles */
    countryCodes: string[];

    /** Human-readable name */
    name: string;

    /**
     * Calculate tax for line items in a specific context.
     * This is called for each line item (or batched).
     */
    calculateTax(items: TaxLineItem[], context: TaxContext): Promise<TaxResult[]>;

    /**
     * Validate that a document (invoice, quote) is compliant.
     * Returns an array of violation messages (empty = compliant).
     */
    validateDocument?(document: any): Promise<string[]>;

    /**
     * Get the applicable tax rate for a zone+class combination.
     * Used for display/preview before full calculation.
     */
    getDefaultRate?(zoneId: string, taxClassId?: string): Promise<number>;
}

export interface CompliancePlugin {
    /** Country code(s) this plugin handles */
    countryCodes: string[];

    /** Human-readable name */
    name: string;

    /**
     * Process an invoice for submission to tax authority.
     * e.g., IL → SHAAM, EU → SAF-T XML
     */
    processInvoice?(invoice: any): Promise<{ success: boolean; referenceId?: string; error?: string }>;

    /**
     * Generate periodic compliance report.
     * e.g., Monthly VAT report, annual summary
     */
    generateReport?(period: { from: Date; to: Date }, type: string): Promise<any>;
}

// ============================================================================
// 2. DEFAULT TAX PLUGIN (Fallback)
// ============================================================================
// Used when no specific country plugin is registered or matched.
// Returns 0 tax — forces tenants to configure their tax zones properly.

export const defaultTaxPlugin: TaxPlugin = {
    countryCodes: ['*'],
    name: 'Default Tax Plugin (No Tax)',

    async calculateTax(items: TaxLineItem[], _context: TaxContext): Promise<TaxResult[]> {
        return items.map(() => ({
            taxAmount: 0,
            breakdown: [],
            isExempt: false,
        }));
    },

    async getDefaultRate(_zoneId: string, _taxClassId?: string): Promise<number> {
        return 0;
    },
};

// ============================================================================
// 3. PLUGIN REGISTRY
// ============================================================================

class PluginRegistryClass {
    private taxPlugins: Map<string, TaxPlugin> = new Map();
    private compliancePlugins: Map<string, CompliancePlugin> = new Map();

    // --- Tax Plugins ---

    registerTaxPlugin(countryCode: string, plugin: TaxPlugin): void {
        this.taxPlugins.set(countryCode.toUpperCase(), plugin);
    }

    getTaxPlugin(countryCode: string): TaxPlugin {
        return this.taxPlugins.get(countryCode.toUpperCase()) || defaultTaxPlugin;
    }

    /**
     * Find the best matching tax plugin for a tenant's compliance_plugins.
     * Returns the first matching plugin or the default.
     */
    resolveTaxPlugin(compliancePlugins: string[]): TaxPlugin {
        for (const cc of compliancePlugins) {
            const plugin = this.taxPlugins.get(cc.toUpperCase());
            if (plugin) return plugin;
        }
        return defaultTaxPlugin;
    }

    // --- Compliance Plugins ---

    registerCompliancePlugin(countryCode: string, plugin: CompliancePlugin): void {
        this.compliancePlugins.set(countryCode.toUpperCase(), plugin);
    }

    getCompliancePlugin(countryCode: string): CompliancePlugin | undefined {
        return this.compliancePlugins.get(countryCode.toUpperCase());
    }

    // --- Introspection ---

    getRegisteredTaxPlugins(): string[] {
        return Array.from(this.taxPlugins.keys());
    }

    getRegisteredCompliancePlugins(): string[] {
        return Array.from(this.compliancePlugins.keys());
    }
}

// Singleton instance
export const PluginRegistry = new PluginRegistryClass();
