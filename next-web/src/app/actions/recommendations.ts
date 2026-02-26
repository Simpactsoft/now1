"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { actionError, actionSuccess, ActionResult } from "@/lib/action-result";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";
import { z } from "zod";

const getRecommendationsSchema = z.object({
    tenantId: z.string().uuid(),
    cartProductIds: z.array(z.string().uuid()).min(1),
});

export type RecommendationItem = {
    id: string; // The target product id
    name: string;
    sku: string;
    list_price: number;
    currency: string;
    relationship_type: string;
    confidence_score: number;
    source_product_id: string;
};

/**
 * Retrieves a list of recommended products based on the items currently in the cart.
 * Sorts by confidence score descending.
 */
export async function getRecommendations(input: {
    tenantId: string;
    cartProductIds: string[];
}): Promise<ActionResult<{ recommendations: RecommendationItem[] }>> {
    try {
        const validated = getRecommendationsSchema.parse(input);

        // Auth: verify the caller belongs to this tenant
        const auth = await verifyAuthWithTenant(validated.tenantId);
        if (isAuthError(auth)) return actionError(auth.error, "AUTH_ERROR");

        const adminClient = createAdminClient();

        // Query the relationships table where the source product is in the cart
        // and we select the expanded details of the target_product_id.
        const { data, error } = await adminClient
            .from("product_relationships")
            .select(`
                relationship_type,
                confidence_score,
                source_product_id,
                target:products!product_relationships_target_product_id_fkey (
                    id,
                    name,
                    sku,
                    list_price
                )
            `)
            .eq("tenant_id", validated.tenantId)
            .in("source_product_id", validated.cartProductIds)
            .order("confidence_score", { ascending: false });

        if (error) {
            console.error("[getRecommendations] DB Error:", error);
            return actionError("Failed to fetch recommendations.", "DB_ERROR");
        }

        if (!data || data.length === 0) {
            return actionSuccess({ recommendations: [] });
        }

        // Map and filter active products, deduplicating target IDs 
        // in case multiple cart items suggest the same target.
        const seenTargetIds = new Set<string>();
        const recommendations: RecommendationItem[] = [];

        for (const row of data) {
            const tgt = row.target as any;
            if (!tgt || tgt.id == null) continue;

            // Avoid duplicate recommendations
            // Also avoid suggesting things they already have in the cart
            if (seenTargetIds.has(tgt.id) || validated.cartProductIds.includes(tgt.id)) {
                continue;
            }

            seenTargetIds.add(tgt.id);
            recommendations.push({
                id: tgt.id,
                name: tgt.name,
                sku: tgt.sku,
                list_price: tgt.list_price || 0,
                currency: tgt.currency || 'ILS', // fallback
                relationship_type: row.relationship_type,
                confidence_score: Number(row.confidence_score),
                source_product_id: row.source_product_id,
            });
        }

        return actionSuccess({ recommendations });
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            const msg = err.issues?.[0]?.message || "Invalid input parameters";
            return actionError("Validation error: " + msg, "VALIDATION_ERROR");
        }
        console.error("[getRecommendations] Error:", err);
        return actionError("Internal error while fetching recommendations.", "UNKNOWN");
    }
}
