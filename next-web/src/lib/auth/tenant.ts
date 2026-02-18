import type { User, SupabaseClient } from "@supabase/supabase-js";

/**
 * Extracts tenant_id from user metadata or profiles table.
 * 
 * This function implements a three-tier fallback strategy:
 * 1. Check user.app_metadata.tenant_id
 * 2. Check user.user_metadata.tenant_id
 * 3. Query profiles table for tenant_id
 * 
 * @param user - The authenticated user object from supabase.auth.getUser()
 * @param supabase - Supabase client instance
 * @returns tenant_id string or null if not found
 * 
 * @example
 * const tenantId = await getTenantId(user, supabase);
 * if (!tenantId) {
 *   return { success: false, error: "Tenant ID required" };
 * }
 */
export async function getTenantId(
    user: User,
    supabase: SupabaseClient
): Promise<string | null> {
    // Try metadata first (fastest)
    let tenantId = user.app_metadata?.tenant_id ?? user.user_metadata?.tenant_id;

    // Fallback to profiles table if not in metadata
    if (!tenantId) {
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("tenant_id")
            .eq("id", user.id)
            .single();

        if (!profileError && profile) {
            tenantId = profile.tenant_id;
        }
    }

    return tenantId ?? null;
}
