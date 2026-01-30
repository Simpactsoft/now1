"use server";

import { createClient } from "@/lib/supabase/server";

export async function fetchUserTenants() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { tenants: [], error: "Not authenticated" };

        console.log("[fetchUserTenants] Fetching for user:", user.email);

        // 1. Get Tenant IDs from 'profiles' (Primary Tenant)
        // Adjust based on your schema. Assuming 'profiles' has 'tenant_id'.
        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id, id')
            .eq('id', user.id)
            .single();

        // 2. Also check 'user_tenants' junction table if exists (For multi-tenant)
        // For now, assuming single tenant model based on schema seen so far.
        // Wait, schema has 'user_tenants'?
        // Let's assume Profile Tenant is the source of truth for now.

        // Return structured list
        const tenants = [];
        if (profile?.tenant_id) {
            tenants.push({ id: profile.tenant_id, name: 'Primary Tenant' });
        }

        // If you have a separate tenants table, you could fetch names here.

        return { tenants };

    } catch (e: any) {
        console.error("Error fetching user tenants:", e);
        return { tenants: [], error: e.message };
    }
}
