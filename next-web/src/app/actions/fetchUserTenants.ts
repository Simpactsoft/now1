"use server";

import { createClient } from "@/lib/supabase/server";

export async function fetchUserTenants() {
    try {
        const supabase = await createClient();

        // Use the robust JSON RPC that includes Admin Bypass logic
        const { data, error } = await supabase.rpc('get_tenants_json');

        if (error) {
            console.error("[fetchUserTenants] RPC Error:", error);
            // Return empty array on error to allow the app to continue (or handle gracefully)
            return { tenants: [], error: error.message };
        }

        // RPC returns JSON, so we just cast it
        const tenants = (data as any[]) || [];

        return { tenants };

    } catch (e: any) {
        console.error("Error fetching user tenants:", e);
        return { tenants: [], error: e.message };
    }
}
