"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError, type ActionResult } from "./_shared/auth-utils";
import { createVariantAttributeSchema, addAttributeValueSchema, createVariantSchema, validateSchema } from "./_shared/schemas";

// ============================================================================
// TYPES
// ============================================================================

interface VariantAttribute {
    id: string;
    tenantId: string;
    name: string;
    displayName: string | null;
    sortOrder: number;
    values: VariantAttributeValue[];
}

interface VariantAttributeValue {
    id: string;
    attributeId: string;
    value: string;
    displayValue: string | null;
    colorHex: string | null;
    sortOrder: number;
}

interface ProductVariant {
    id: string;
    tenantId: string;
    parentProductId: string;
    sku: string;
    name: string;
    attributeValues: Record<string, string>;
    costPrice: number;
    listPrice: number;
    isActive: boolean;
    barcode: string | null;
    sortOrder: number;
}

// ============================================================================
// VARIANT ATTRIBUTES
// ============================================================================

/**
 * Get all variant attributes with their values for a tenant.
 */
export async function getVariantAttributes(
    tenantId: string
): Promise<ActionResult<VariantAttribute[]>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        // Fetch attributes
        const { data: attrs, error: attrErr } = await adminClient
            .from("variant_attributes")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("sort_order");

        if (attrErr) return { success: false, error: attrErr.message };

        // Fetch all values for this tenant
        const { data: vals, error: valErr } = await adminClient
            .from("variant_attribute_values")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("sort_order");

        if (valErr) return { success: false, error: valErr.message };

        // Group values by attribute
        const valuesMap = new Map<string, VariantAttributeValue[]>();
        for (const v of vals || []) {
            const attrId = v.attribute_id as string;
            if (!valuesMap.has(attrId)) valuesMap.set(attrId, []);
            valuesMap.get(attrId)!.push({
                id: v.id,
                attributeId: v.attribute_id,
                value: v.value,
                displayValue: v.display_value,
                colorHex: v.color_hex,
                sortOrder: v.sort_order,
            });
        }

        const attributes: VariantAttribute[] = (attrs || []).map((a: Record<string, unknown>) => ({
            id: a.id as string,
            tenantId: a.tenant_id as string,
            name: a.name as string,
            displayName: a.display_name as string | null,
            sortOrder: a.sort_order as number,
            values: valuesMap.get(a.id as string) || [],
        }));

        return { success: true, data: attributes };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Create a variant attribute (e.g., "Color", "Size").
 */
export async function createVariantAttribute(
    tenantId: string,
    attr: { name: string; displayName?: string; sortOrder?: number }
): Promise<ActionResult<{ id: string }>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        // Zod validation
        const v = validateSchema(createVariantAttributeSchema, attr);
        if (!v.success) return { success: false, error: v.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient
            .from("variant_attributes")
            .insert({
                tenant_id: tenantId,
                name: attr.name.trim(),
                display_name: attr.displayName || null,
                sort_order: attr.sortOrder ?? 0,
            })
            .select("id")
            .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: { id: data.id } };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Add a value to a variant attribute (e.g., "Red" to "Color").
 */
export async function addVariantAttributeValue(
    tenantId: string,
    attributeId: string,
    val: { value: string; displayValue?: string; colorHex?: string; sortOrder?: number }
): Promise<ActionResult<{ id: string }>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        // Zod validation
        const v = validateSchema(addAttributeValueSchema, val);
        if (!v.success) return { success: false, error: v.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient
            .from("variant_attribute_values")
            .insert({
                tenant_id: tenantId,
                attribute_id: attributeId,
                value: val.value.trim(),
                display_value: val.displayValue || null,
                color_hex: val.colorHex || null,
                sort_order: val.sortOrder ?? 0,
            })
            .select("id")
            .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: { id: data.id } };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

// ============================================================================
// PRODUCT VARIANTS
// ============================================================================

/**
 * Get all variants for a product.
 */
export async function getProductVariants(
    tenantId: string,
    productId: string
): Promise<ActionResult<ProductVariant[]>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient
            .from("product_variants")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("parent_product_id", productId)
            .order("sort_order");

        if (error) return { success: false, error: error.message };

        const variants: ProductVariant[] = (data || []).map((v: Record<string, unknown>) => ({
            id: v.id as string,
            tenantId: v.tenant_id as string,
            parentProductId: v.parent_product_id as string,
            sku: v.sku as string,
            name: v.name as string,
            attributeValues: v.attribute_values as Record<string, string>,
            costPrice: parseFloat(v.cost_price as string),
            listPrice: parseFloat(v.list_price as string),
            isActive: v.is_active as boolean,
            barcode: v.barcode as string | null,
            sortOrder: v.sort_order as number,
        }));

        return { success: true, data: variants };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Create a new product variant.
 */
export async function createVariant(
    tenantId: string,
    variant: {
        parentProductId: string;
        sku: string;
        name?: string;
        attributeValues: Record<string, string>;
        costPrice?: number;
        listPrice?: number;
        barcode?: string;
        sortOrder?: number;
    }
): Promise<ActionResult<ProductVariant>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        // Zod validation
        const v = validateSchema(createVariantSchema, {
            sku: variant.sku,
            attributeValues: variant.attributeValues,
            costPrice: variant.costPrice,
            listPrice: variant.listPrice,
            isActive: true,
            barcode: variant.barcode,
            sortOrder: variant.sortOrder,
        });
        if (!v.success) return { success: false, error: v.error };

        const adminClient = createAdminClient();

        // Ensure parent product has has_variants = true
        await adminClient
            .from("products")
            .update({ has_variants: true })
            .eq("id", variant.parentProductId)
            .eq("tenant_id", tenantId);

        const { data, error } = await adminClient
            .from("product_variants")
            .insert({
                tenant_id: tenantId,
                parent_product_id: variant.parentProductId,
                sku: variant.sku.trim(),
                name: variant.name || null, // Trigger will auto-generate if null
                attribute_values: variant.attributeValues,
                cost_price: variant.costPrice ?? 0,
                list_price: variant.listPrice ?? 0,
                barcode: variant.barcode || null,
                sort_order: variant.sortOrder ?? 0,
            })
            .select()
            .single();

        if (error) return { success: false, error: error.message };

        revalidatePath("/dashboard");

        return {
            success: true,
            data: {
                id: data.id,
                tenantId: data.tenant_id,
                parentProductId: data.parent_product_id,
                sku: data.sku,
                name: data.name,
                attributeValues: data.attribute_values,
                costPrice: parseFloat(data.cost_price),
                listPrice: parseFloat(data.list_price),
                isActive: data.is_active,
                barcode: data.barcode,
                sortOrder: data.sort_order,
            },
        };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Update an existing variant.
 */
export async function updateVariant(
    tenantId: string,
    variantId: string,
    updates: {
        sku?: string;
        name?: string;
        costPrice?: number;
        listPrice?: number;
        isActive?: boolean;
        barcode?: string;
        sortOrder?: number;
    }
): Promise<ActionResult<null>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const payload: Record<string, unknown> = {};
        if (updates.sku !== undefined) payload.sku = updates.sku;
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.costPrice !== undefined) payload.cost_price = updates.costPrice;
        if (updates.listPrice !== undefined) payload.list_price = updates.listPrice;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;
        if (updates.barcode !== undefined) payload.barcode = updates.barcode;
        if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

        const { error } = await adminClient
            .from("product_variants")
            .update(payload)
            .eq("id", variantId)
            .eq("tenant_id", tenantId);

        if (error) return { success: false, error: error.message };

        revalidatePath("/dashboard");
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Delete a variant.
 */
export async function deleteVariant(
    tenantId: string,
    variantId: string
): Promise<ActionResult<null>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { error } = await adminClient
            .from("product_variants")
            .delete()
            .eq("id", variantId)
            .eq("tenant_id", tenantId);

        if (error) return { success: false, error: error.message };

        revalidatePath("/dashboard");
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}
