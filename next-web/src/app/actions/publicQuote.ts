"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";
import { z } from "zod";

const TokenSchema = z.string().uuid("Invalid quote token format");

/**
 * Fetches a quote securely using only its public_token.
 * Does NOT require the user to be authenticated.
 */
export async function getPublicQuote(token: string): Promise<ActionResult<any>> {
    try {
        const parsedToken = TokenSchema.safeParse(token);
        if (!parsedToken.success) {
            return actionError("Invalid quote link.", "VALIDATION_ERROR");
        }

        const adminClient = createAdminClient();

        // Fetch Quote + Items + Customer + Tenant Info
        const { data: quote, error } = await adminClient
            .from("quotes")
            .select(`
                *,
                customer:cards ( id, display_name, contact_methods ),
                items:quote_items (
                    id, product_id, configuration_id, quantity, unit_price, line_total,
                    product:products ( name, description, sku )
                ),
                tenant:tenants ( name, rtl_enabled )
            `)
            .eq("public_token", token)
            .single();

        if (error || !quote) {
            console.error("[getPublicQuote] DB Error:", error);
            return actionError("Quote not found or link has expired.", "NOT_FOUND");
        }

        // Only allow viewing if draft, sent, or won
        if (quote.status === "cancelled") {
            return actionError("This quote has been cancelled.", "INVALID_STATE");
        }

        return actionSuccess(quote);
    } catch (e: any) {
        console.error("[getPublicQuote] Unexpected error:", e);
        return actionError("An unexpected error occurred.", "INTERNAL_ERROR");
    }
}

/**
 * Marks a quote as accepted (Won) using its public token.
 */
export async function acceptPublicQuote(token: string, clientIp: string): Promise<ActionResult<void>> {
    try {
        const parsedToken = TokenSchema.safeParse(token);
        if (!parsedToken.success) {
            return actionError("Invalid quote link.", "VALIDATION_ERROR");
        }

        const adminClient = createAdminClient();

        // 1. Verify existence and current status
        const { data: quote, error: checkError } = await adminClient
            .from("quotes")
            .select("id, status")
            .eq("public_token", token)
            .single();

        if (checkError || !quote) {
            return actionError("Quote not found.", "NOT_FOUND");
        }

        if (quote.status === "won") {
            return actionError("This quote has already been accepted.", "ALREADY_ACCEPTED");
        }
        if (quote.status === "cancelled") {
            return actionError("Cannot accept a cancelled quote.", "INVALID_STATE");
        }

        // 2. Update to Won and record acceptance details
        const { error: updateError } = await adminClient
            .from("quotes")
            .update({
                status: "won",
                accepted_at: new Date().toISOString(),
                accepted_by_ip: clientIp || "unknown"
            })
            .eq("id", quote.id);

        if (updateError) {
            console.error("[acceptPublicQuote] Update error:", updateError);
            return actionError("Failed to save acceptance signature.", "DB_ERROR");
        }

        return actionSuccess(undefined);
    } catch (e: any) {
        console.error("[acceptPublicQuote] Unexpected error:", e);
        return actionError("An unexpected error occurred.", "INTERNAL_ERROR");
    }
}
