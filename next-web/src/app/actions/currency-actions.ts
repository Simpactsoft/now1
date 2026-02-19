"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// ============================================================================
// TYPES
// ============================================================================

interface Currency {
    code: string;
    name: string;
    symbol: string;
    decimalPlaces: number;
    isActive: boolean;
}

interface ExchangeRate {
    id: string;
    tenantId: string;
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    validFrom: string;
    source: string;
    createdAt: string;
}

interface ActionResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Get all active currencies from the global reference table.
 * No tenant-scoping — currencies are shared across all tenants.
 */
export async function getCurrencies(): Promise<ActionResult<Currency[]>> {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("currencies")
            .select("*")
            .eq("is_active", true)
            .order("code");

        if (error) {
            return { success: false, error: error.message };
        }

        const currencies: Currency[] = (data || []).map((c: Record<string, unknown>) => ({
            code: c.code as string,
            name: c.name as string,
            symbol: c.symbol as string,
            decimalPlaces: c.decimal_places as number,
            isActive: c.is_active as boolean,
        }));

        return { success: true, data: currencies };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Get exchange rates for the current tenant.
 * Returns the most recent rate for each currency pair.
 */
export async function getExchangeRates(
    tenantId: string
): Promise<ActionResult<ExchangeRate[]>> {
    try {
        const supabase = await createClient();

        // Verify auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: "Not authenticated" };
        }

        const adminClient = createAdminClient();

        // Set tenant context for RLS
        await adminClient.rpc("set_tenant_context", { p_tenant_id: tenantId });

        const { data, error } = await adminClient
            .from("exchange_rates")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("valid_from", { ascending: false });

        if (error) {
            return { success: false, error: error.message };
        }

        const rates: ExchangeRate[] = (data || []).map((r: Record<string, unknown>) => ({
            id: r.id as string,
            tenantId: r.tenant_id as string,
            fromCurrency: r.from_currency as string,
            toCurrency: r.to_currency as string,
            rate: parseFloat(r.rate as string),
            validFrom: r.valid_from as string,
            source: r.source as string,
            createdAt: r.created_at as string,
        }));

        return { success: true, data: rates };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Add or update an exchange rate for the current tenant.
 * Inserts a new rate record (rates are append-only for audit trail).
 */
export async function upsertExchangeRate(
    tenantId: string,
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    source: string = "manual"
): Promise<ActionResult<ExchangeRate>> {
    try {
        if (fromCurrency === toCurrency) {
            return { success: false, error: "Cannot set rate for same currency pair" };
        }

        if (rate <= 0) {
            return { success: false, error: "Rate must be positive" };
        }

        const supabase = await createClient();

        // Verify auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: "Not authenticated" };
        }

        const adminClient = createAdminClient();

        const { data, error } = await adminClient
            .from("exchange_rates")
            .insert({
                tenant_id: tenantId,
                from_currency: fromCurrency,
                to_currency: toCurrency,
                rate,
                source,
                valid_from: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/dashboard");

        return {
            success: true,
            data: {
                id: data.id,
                tenantId: data.tenant_id,
                fromCurrency: data.from_currency,
                toCurrency: data.to_currency,
                rate: parseFloat(data.rate),
                validFrom: data.valid_from,
                source: data.source,
                createdAt: data.created_at,
            },
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Convert an amount between currencies using the server-side RPC.
 * Useful for preview/display — the RPC handles inverse rates automatically.
 */
export async function convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    tenantId: string,
    timestamp?: string
): Promise<ActionResult<{ convertedAmount: number; rate: number }>> {
    try {
        if (fromCurrency === toCurrency) {
            return { success: true, data: { convertedAmount: amount, rate: 1 } };
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: "Not authenticated" };
        }

        const adminClient = createAdminClient();

        const { data, error } = await adminClient.rpc("convert_currency", {
            p_amount: amount,
            p_from_currency: fromCurrency,
            p_to_currency: toCurrency,
            p_tenant_id: tenantId,
            p_timestamp: timestamp || new Date().toISOString(),
        });

        if (error) {
            return { success: false, error: error.message };
        }

        // Calculate effective rate from the conversion
        const effectiveRate = amount !== 0 ? data / amount : 0;

        return {
            success: true,
            data: {
                convertedAmount: parseFloat(data),
                rate: effectiveRate,
            },
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
