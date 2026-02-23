"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";
import { revalidatePath } from "next/cache";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

export interface CreateProductInput {
    tenantId: string;
    sku: string;
    name: string;
    list_price?: number;
    cost_price?: number;
    product_type?: string;
    track_inventory?: boolean;
    description?: string;
    category_id?: string;
    is_configurable?: boolean;
    template_id?: string;
}

export async function createProduct(params: CreateProductInput): Promise<ActionResult<any>> {
    const { tenantId, sku, name, list_price, cost_price, product_type, track_inventory, description, category_id, is_configurable, template_id } = params;

    if (!tenantId || !sku || !name) {
        return actionError("Tenant ID, SKU, and Name are required", "VALIDATION_ERROR");
    }

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) {
        return actionError(auth.error, 'AUTH_ERROR');
    }

    const adminClient = createAdminClient();

    try {
        const { data, error } = await adminClient
            .from('products')
            .insert({
                tenant_id: tenantId,
                sku,
                name,
                list_price: list_price || 0,
                cost_price: cost_price || 0,
                track_inventory: track_inventory ?? true,
                description: description || null,
                category_id: category_id || null,
                is_configurable: is_configurable || false,
                template_id: template_id || null
            })
            .select()
            .single();

        if (error) {
            console.error("createProduct Error:", error);
            // Check for unique SKU constraint violation
            if (error.code === '23505') {
                return actionError(`A product with SKU "${sku}" already exists.`, "VALIDATION_ERROR");
            }
            throw error;
        }

        revalidatePath('/dashboard/products');
        return actionSuccess(data);
    } catch (error: any) {
        console.error("createProduct Exception:", error);
        return actionError(error.message, "DB_ERROR");
    }
}
