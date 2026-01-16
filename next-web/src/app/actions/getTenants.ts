"use server";

import { createClient } from "@/lib/supabase/server";

export async function getTenants() {
    const supabase = await createClient();

    // Note: This might be restricted by RLS if app.current_tenant is already set.
    // But we usually want to see all tenants to switch between them in this "God Mode".
    // For a real app, this would be restricted to tenants the user belongs to.
    // PHASE 6: Secure Discovery Protocol
    // We now use a SECURITY DEFINER RPC to bypass the RLS initialization paradox.
    // This allows fetching authorized tenants even when app.current_tenant is not yet set.
    console.log("--- getTenants() Called ---");
    const { data, error } = await supabase.rpc("get_my_tenants");

    if (error) {
        console.error("getTenants error:", error);
        // Fallback for if the migration hasn't been applied yet or fails
        console.warn("RPC get_my_tenants failed, falling back to direct query:", error.message);

        const { data: legacyData, error: legacyError } = await supabase
            .from("tenants")
            .select("id, name")
            .order("name");

        if (legacyError) {
            console.error("--- getTenants LEGACY FALLBACK ERROR ---");
            console.error("Code:", legacyError.code);
            console.error("Message:", legacyError.message);
            console.error("---------------------------------");
            return [];
        }
        console.log(`getTenants fallback success: ${legacyData?.length || 0} tenants`);
        return legacyData || [];
    }

    console.log(`getTenants RPC success: ${data?.length || 0} tenants found.`);
    return data || [];
}
