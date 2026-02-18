"use server";

import { createClient } from "@/lib/supabase/server";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

export async function fetchUserTenants(): Promise<ActionResult<{ tenants: any[] }>> {
    try {
        const supabase = await createClient();

        // Use the robust JSON RPC that includes Admin Bypass logic
        const { data, error } = await supabase.rpc('get_tenants_json');

        if (error) {
            console.error("[fetchUserTenants] RPC Error:", error);
            // Return empty array on error to allow the app to continue (or handle gracefully)
            return actionError(error.message, "DB_ERROR");
        }

        // RPC returns JSON, so we just cast it
        const tenants = (data as any[]) || [];

        return actionSuccess({ tenants });

    } catch (e: any) {
        console.error("Error fetching user tenants:", e);
        return actionError(e.message);
    }
}
