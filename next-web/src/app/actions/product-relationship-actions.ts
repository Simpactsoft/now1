"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";
import { ActionResult, actionSuccess, actionError, actionOk } from "@/lib/action-result";

export async function fetchProductRelationships(tenantId: string, sourceProductId: string): Promise<ActionResult<any[]>> {
    if (!tenantId || !sourceProductId) return actionError("Missing required parameters", "VALIDATION_ERROR");

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return actionError(auth.error, "AUTH_ERROR");

    const adminClient = createAdminClient();

    const { data, error } = await adminClient
        .from("product_relationships")
        .select(`
            *,
            target_product:target_product_id ( id, name, sku, list_price, status )
        `)
        .eq("tenant_id", tenantId)
        .eq("source_product_id", sourceProductId)
        .order("confidence_score", { ascending: false });

    if (error) {
        console.error("fetchProductRelationships error:", error);
        return actionError("Failed to fetch relationships", "DB_ERROR");
    }

    return actionSuccess(data || []);
}

const UpsertRelationshipSchema = z.object({
    tenantId: z.string().min(1),
    sourceProductId: z.string().min(1),
    targetProductId: z.string().min(1),
    relationshipType: z.enum(['upsell', 'cross_sell', 'accessory']),
    confidenceScore: z.number().min(0).max(100).default(100)
});

export async function upsertProductRelationship(payload: z.infer<typeof UpsertRelationshipSchema>): Promise<ActionResult<any>> {
    const parsed = UpsertRelationshipSchema.safeParse(payload);
    if (!parsed.success) return actionError("Invalid input", "VALIDATION_ERROR");

    const { tenantId, sourceProductId, targetProductId, relationshipType, confidenceScore } = parsed.data;

    if (sourceProductId === targetProductId) {
        return actionError("A product cannot be related to itself.", "VALIDATION_ERROR");
    }

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return actionError(auth.error, "AUTH_ERROR");

    const adminClient = createAdminClient();

    const { data, error } = await adminClient
        .from("product_relationships")
        .upsert({
            tenant_id: tenantId,
            source_product_id: sourceProductId,
            target_product_id: targetProductId,
            relationship_type: relationshipType,
            confidence_score: confidenceScore,
            updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id, source_product_id, target_product_id, relationship_type' })
        .select(`
            *,
            target_product:target_product_id ( id, name, sku, list_price, status )
        `)
        .single();

    if (error) {
        console.error("upsertProductRelationship error:", error);
        return actionError(error.message, "DB_ERROR");
    }

    return actionSuccess(data);
}

export async function removeProductRelationship(tenantId: string, relationshipId: string): Promise<ActionResult<void>> {
    if (!tenantId || !relationshipId) return actionError("Missing required parameters", "VALIDATION_ERROR");

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return actionError(auth.error, "AUTH_ERROR");

    const adminClient = createAdminClient();
    const { error } = await adminClient
        .from("product_relationships")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", relationshipId);

    if (error) {
        console.error("removeProductRelationship error:", error);
        return actionError(error.message, "DB_ERROR");
    }

    return actionOk();
}

export async function searchProducts(tenantId: string, query: string): Promise<ActionResult<any[]>> {
    if (!tenantId || !query || query.length < 2) return actionSuccess([]);

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return actionError(auth.error, "AUTH_ERROR");

    const adminClient = createAdminClient();
    const { data } = await adminClient
        .from("products")
        .select("id, name, sku, list_price")
        .eq("tenant_id", tenantId)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
        .limit(5);

    return actionSuccess(data || []);
}
