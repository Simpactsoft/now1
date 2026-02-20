"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthContext } from "./auth-utils";

// Re-export types so existing imports still work
export type { ActionResult, AuthContext } from "./auth-utils";

// ============================================================================
// AUTH HELPERS
// ============================================================================

/**
 * Verify user is authenticated. Returns userId or error.
 */
export async function verifyAuth(): Promise<AuthContext | { error: string }> {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { error: "Not authenticated" };
    return { userId: user.id };
}

/**
 * Verify user is authenticated AND belongs to the specified tenant.
 * Prevents cross-tenant access when using adminClient.
 */
export async function verifyAuthWithTenant(
    tenantId: string
): Promise<AuthContext | { error: string }> {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { error: "Not authenticated" };

    const adminClient = createAdminClient();
    const { data: membership } = await adminClient
        .from("tenant_members")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .limit(1);

    if (!membership || membership.length === 0) {
        return { error: "Access denied: not a member of this tenant" };
    }

    return { userId: user.id, tenantId };
}
