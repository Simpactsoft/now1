"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError, type ActionResult } from "./_shared/auth-utils";
import { upsertPriceListSchema, upsertPriceListItemSchema, validateSchema } from "./_shared/schemas";

// ============================================================================
// TYPES
// ============================================================================

interface PriceList {
    id: string;
    tenantId: string;
    name: string;
    description: string | null;
    currency: string;
    priority: number;
    isActive: boolean;
    validFrom: string | null;
    validTo: string | null;
    createdAt: string;
}

interface PriceListItem {
    id: string;
    tenantId: string;
    priceListId: string;
    productId: string;
    unitPrice: number;
    minQuantity: number;
    maxQuantity: number | null;
    discountPercent: number;
    notes: string | null;
}

interface EffectivePrice {
    effectivePrice: number;
    priceListId: string | null;
    priceListName: string;
    priceSource: 'customer_list' | 'general_list' | 'base_price';
}

// ============================================================================
// PRICE LIST CRUD
// ============================================================================

/**
 * Get all price lists for a tenant (with optional pagination).
 */
export async function getPriceLists(
    tenantId: string,
    pagination?: { page?: number; pageSize?: number }
): Promise<ActionResult<PriceList[]> & { totalCount?: number }> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        // Count total for pagination metadata
        const { count } = await adminClient
            .from("price_lists")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId);

        let query = adminClient
            .from("price_lists")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("priority", { ascending: false });

        // Apply pagination if provided
        if (pagination?.page && pagination?.pageSize) {
            const from = (pagination.page - 1) * pagination.pageSize;
            const to = from + pagination.pageSize - 1;
            query = query.range(from, to);
        }

        const { data, error } = await query;

        if (error) return { success: false, error: error.message };

        const priceLists: PriceList[] = (data || []).map((pl: Record<string, unknown>) => ({
            id: pl.id as string,
            tenantId: pl.tenant_id as string,
            name: pl.name as string,
            description: pl.description as string | null,
            currency: pl.currency as string,
            priority: pl.priority as number,
            isActive: pl.is_active as boolean,
            validFrom: pl.valid_from as string | null,
            validTo: pl.valid_to as string | null,
            createdAt: pl.created_at as string,
        }));

        return { success: true, data: priceLists, totalCount: count ?? undefined };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Get items (product prices) for a specific price list.
 */
export async function getPriceListItems(
    tenantId: string,
    priceListId: string
): Promise<ActionResult<PriceListItem[]>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient
            .from("price_list_items")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("price_list_id", priceListId)
            .order("min_quantity");

        if (error) return { success: false, error: error.message };

        const items: PriceListItem[] = (data || []).map((i: Record<string, unknown>) => ({
            id: i.id as string,
            tenantId: i.tenant_id as string,
            priceListId: i.price_list_id as string,
            productId: i.product_id as string,
            unitPrice: parseFloat(i.unit_price as string),
            minQuantity: parseFloat(i.min_quantity as string),
            maxQuantity: i.max_quantity ? parseFloat(i.max_quantity as string) : null,
            discountPercent: parseFloat(i.discount_percent as string),
            notes: i.notes as string | null,
        }));

        return { success: true, data: items };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Create or update a price list.
 */
export async function upsertPriceList(
    tenantId: string,
    priceList: {
        id?: string;
        name: string;
        description?: string;
        currency?: string;
        priority?: number;
        isActive?: boolean;
        validFrom?: string;
        validTo?: string;
    }
): Promise<ActionResult<PriceList>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        // Zod validation
        const v = validateSchema(upsertPriceListSchema, {
            name: priceList.name,
            description: priceList.description,
            currency: priceList.currency || 'ILS',
            priority: priceList.priority ?? 0,
            isActive: priceList.isActive,
            validFrom: priceList.validFrom,
            validTo: priceList.validTo,
        });
        if (!v.success) return { success: false, error: v.error };

        const adminClient = createAdminClient();

        const payload = {
            tenant_id: tenantId,
            name: priceList.name.trim(),
            description: priceList.description || null,
            currency: priceList.currency || 'ILS',
            priority: priceList.priority ?? 0,
            is_active: priceList.isActive ?? true,
            valid_from: priceList.validFrom || null,
            valid_to: priceList.validTo || null,
        };

        let result;
        if (priceList.id) {
            // Update
            const { data, error } = await adminClient
                .from("price_lists")
                .update(payload)
                .eq("id", priceList.id)
                .eq("tenant_id", tenantId)
                .select()
                .single();
            result = { data, error };
        } else {
            // Insert
            const { data, error } = await adminClient
                .from("price_lists")
                .insert(payload)
                .select()
                .single();
            result = { data, error };
        }

        if (result.error) return { success: false, error: result.error.message };

        revalidatePath("/dashboard");

        const d = result.data;
        return {
            success: true,
            data: {
                id: d.id,
                tenantId: d.tenant_id,
                name: d.name,
                description: d.description,
                currency: d.currency,
                priority: d.priority,
                isActive: d.is_active,
                validFrom: d.valid_from,
                validTo: d.valid_to,
                createdAt: d.created_at,
            },
        };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Add or update a price list item (product price within a list).
 */
export async function upsertPriceListItem(
    tenantId: string,
    item: {
        id?: string;
        priceListId: string;
        productId: string;
        unitPrice: number;
        minQuantity?: number;
        maxQuantity?: number | null;
        discountPercent?: number;
        notes?: string;
    }
): Promise<ActionResult<PriceListItem>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        if (item.unitPrice < 0) {
            return { success: false, error: "Unit price must be non-negative" };
        }

        const adminClient = createAdminClient();

        const payload = {
            tenant_id: tenantId,
            price_list_id: item.priceListId,
            product_id: item.productId,
            unit_price: item.unitPrice,
            min_quantity: item.minQuantity ?? 1,
            max_quantity: item.maxQuantity ?? null,
            discount_percent: item.discountPercent ?? 0,
            notes: item.notes || null,
        };

        let result;
        if (item.id) {
            const { data, error } = await adminClient
                .from("price_list_items")
                .update(payload)
                .eq("id", item.id)
                .eq("tenant_id", tenantId)
                .select()
                .single();
            result = { data, error };
        } else {
            const { data, error } = await adminClient
                .from("price_list_items")
                .insert(payload)
                .select()
                .single();
            result = { data, error };
        }

        if (result.error) return { success: false, error: result.error.message };

        revalidatePath("/dashboard");

        const d = result.data;
        return {
            success: true,
            data: {
                id: d.id,
                tenantId: d.tenant_id,
                priceListId: d.price_list_id,
                productId: d.product_id,
                unitPrice: parseFloat(d.unit_price),
                minQuantity: parseFloat(d.min_quantity),
                maxQuantity: d.max_quantity ? parseFloat(d.max_quantity) : null,
                discountPercent: parseFloat(d.discount_percent),
                notes: d.notes,
            },
        };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

// ============================================================================
// PRICE RESOLUTION
// ============================================================================

/**
 * Get the effective price for a product, considering customer-specific lists.
 * Uses the server-side get_effective_price() RPC.
 */
export async function getEffectivePrice(
    tenantId: string,
    productId: string,
    customerId?: string,
    quantity?: number
): Promise<ActionResult<EffectivePrice>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient.rpc("get_effective_price", {
            p_tenant_id: tenantId,
            p_product_id: productId,
            p_customer_id: customerId || null,
            p_quantity: quantity || 1,
            p_date: new Date().toISOString().split('T')[0],
        });

        if (error) return { success: false, error: error.message };

        if (!data || data.length === 0) {
            return { success: false, error: "No price found for product" };
        }

        const row = data[0];
        return {
            success: true,
            data: {
                effectivePrice: parseFloat(row.effective_price),
                priceListId: row.price_list_id,
                priceListName: row.price_list_name,
                priceSource: row.price_source as EffectivePrice['priceSource'],
            },
        };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

// ============================================================================
// CUSTOMER ASSIGNMENT
// ============================================================================

/**
 * Assign a customer to a price list.
 */
export async function assignCustomerPriceList(
    tenantId: string,
    customerId: string,
    priceListId: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient
            .from("customer_price_list")
            .insert({
                tenant_id: tenantId,
                customer_id: customerId,
                price_list_id: priceListId,
            })
            .select("id")
            .single();

        if (error) return { success: false, error: error.message };

        revalidatePath("/dashboard");
        return { success: true, data: { id: data.id } };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Remove a customer from a price list.
 */
export async function removeCustomerPriceList(
    tenantId: string,
    customerId: string,
    priceListId: string
): Promise<ActionResult<null>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { error } = await adminClient
            .from("customer_price_list")
            .delete()
            .eq("tenant_id", tenantId)
            .eq("customer_id", customerId)
            .eq("price_list_id", priceListId);

        if (error) return { success: false, error: error.message };

        revalidatePath("/dashboard");
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}
