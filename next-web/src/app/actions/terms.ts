"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";
import { z } from "zod";
import { headers } from "next/headers";

const GenerateTermsSchema = z.object({
    productIds: z.array(z.string().uuid()),
    tenantId: z.string().uuid()
});

/**
 * Scans the provided products for their tags, looks up matching legal templates,
 * and concatenates their contents into a single string of terms & conditions.
 */
export async function generateTermsForProducts(
    input: z.infer<typeof GenerateTermsSchema>
): Promise<ActionResult<{ terms: string }>> {
    try {
        const parsed = GenerateTermsSchema.safeParse(input);
        if (!parsed.success) {
            return actionError("Invalid input parameters.", "VALIDATION_ERROR");
        }

        const { productIds, tenantId } = parsed.data;

        if (productIds.length === 0) {
            return actionSuccess({ terms: "" });
        }

        const adminClient = createAdminClient();

        // 1. Fetch tags from products
        const { data: products, error: productsError } = await adminClient
            .from("products")
            .select("tags")
            .in("id", productIds)
            .eq("tenant_id", tenantId);

        if (productsError) {
            console.error("[generateTerms] Products error:", productsError);
            return actionError("Failed to load product details.", "DB_ERROR");
        }

        // 2. Extract unique tags
        const uniqueTags = new Set<string>();
        for (const p of products) {
            if (Array.isArray(p.tags)) {
                p.tags.forEach((tag: string) => uniqueTags.add(tag.toLowerCase().trim()));
            }
        }

        if (uniqueTags.size === 0) {
            return actionSuccess({ terms: "" });
        }

        // 3. Fetch matching legal terms for those tags
        const { data: templates, error: templatesError } = await adminClient
            .from("legal_terms_templates")
            .select("clause_name, content")
            .eq("tenant_id", tenantId)
            .in("trigger_tag", Array.from(uniqueTags))
            .order("created_at", { ascending: true }); // Ensure deterministic ordering

        if (templatesError) {
            console.error("[generateTerms] Templates error:", templatesError);
            return actionError("Failed to fetch legal term templates.", "DB_ERROR");
        }

        // 4. Concatenate templates into a nice formatted string
        if (!templates || templates.length === 0) {
            return actionSuccess({ terms: "" });
        }

        const combinedTerms = templates.map(t => `### ${t.clause_name}\n${t.content}`).join("\n\n");

        return actionSuccess({ terms: combinedTerms });

    } catch (e: any) {
        console.error("[generateTerms] Unexpected error:", e);
        return actionError("An unexpected error occurred.", "INTERNAL_ERROR");
    }
}
