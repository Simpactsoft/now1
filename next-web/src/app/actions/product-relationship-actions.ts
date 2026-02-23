"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";

export async function fetchProductRelationships(tenantId: string, sourceProductId: string) {
    if (!tenantId || !sourceProductId) return { error: "Missing required parameters" };

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { error: "Unauthorized" };

    const adminClient = createAdminClient();

    // We join on `products` to get details of the target products
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
        return { error: "Failed to fetch relationships" };
    }

    return { success: true, data };
}

const UpsertRelationshipSchema = z.object({
    tenantId: z.string().min(1),
    sourceProductId: z.string().min(1),
    targetProductId: z.string().min(1),
    relationshipType: z.enum(['upsell', 'cross_sell', 'accessory']),
    confidenceScore: z.number().min(0).max(100).default(100)
});

export async function upsertProductRelationship(payload: z.infer<typeof UpsertRelationshipSchema>) {
    const parsed = UpsertRelationshipSchema.safeParse(payload);
    if (!parsed.success) return { error: "Invalid input" };

    const { tenantId, sourceProductId, targetProductId, relationshipType, confidenceScore } = parsed.data;

    // Prevent linking to itself
    if (sourceProductId === targetProductId) {
        return { error: "A product cannot be related to itself." };
    }

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { error: "Unauthorized" };

    const adminClient = createAdminClient();

    // We use ON CONFLICT DO UPDATE since there is a UNIQUE constraint on (tenant, source, target, type)
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
        return { error: error.message };
    }

    return { success: true, data };
}

export async function removeProductRelationship(tenantId: string, relationshipId: string) {
    if (!tenantId || !relationshipId) return { error: "Missing required parameters" };

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { error } = await adminClient
        .from("product_relationships")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", relationshipId);

    if (error) {
        console.error("removeProductRelationship error:", error);
        return { error: error.message };
    }

    return { success: true };
}

export async function searchProducts(tenantId: string, query: string) {
    if (!tenantId || !query || query.length < 2) return [];

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return [];

    const adminClient = createAdminClient();
    const { data } = await adminClient
        .from("products")
        .select("id, name, sku, list_price")
        .eq("tenant_id", tenantId)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
        .limit(5);

    return data || [];
}
