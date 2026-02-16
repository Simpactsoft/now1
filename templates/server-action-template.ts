/**
 * SERVER ACTION TEMPLATE WITH TENANT_ID
 * 
 * Copy this template for every server action that needs tenant_id.
 * DO NOT deviate from this pattern!
 * 
 * Usage:
 * 1. Copy this file
 * 2. Rename to your-action.ts
 * 3. Replace MY_ACTION_NAME with your actual action name
 * 4. Replace YOUR_TABLE with your table name
 * 5. Add your specific logic in section 3
 */

"use server";

import { createClient } from "@/lib/supabase/server";

export async function MY_ACTION_NAME(params: {
    // Define your params here
}) {
    const supabase = await createClient();

    try {
        // =========================================================================
        // 1. AUTHENTICATION
        // =========================================================================
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: "Unauthorized" };
        }

        // =========================================================================
        // 2. GET TENANT_ID (STANDARD PATTERN - DON'T CHANGE!)
        // =========================================================================
        let tenantId =
            user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;

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

        if (!tenantId) {
            return {
                success: false,
                error: "Tenant ID required. Please make sure you are assigned to a tenant.",
            };
        }

        // =========================================================================
        // 3. YOUR LOGIC HERE
        // =========================================================================

        // Example: Insert
        const { data, error } = await supabase
            .from("YOUR_TABLE")
            .insert({
                tenant_id: tenantId, // ← ALWAYS include tenant_id!
                // ... your other fields
            })
            .select()
            .single();

        if (error) {
            console.error("Error in MY_ACTION_NAME:", error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (error: any) {
        console.error("Error in MY_ACTION_NAME:", error);
        return { success: false, error: error.message };
    }
}
