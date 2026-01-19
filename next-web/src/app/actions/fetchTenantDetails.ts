"use server";

import { createClient } from "@/lib/supabase/server";

export async function fetchTenantDetails(tenantId: string) {
    const supabase = await createClient();

    // 1. Fetch Tenant Metadata (using God Mode RPC)
    const { data: tenant, error: tenantError } = await supabase
        .rpc('get_admin_tenant', { arg_tenant_id: tenantId })
        .single();

    if (tenantError) return { success: false, error: tenantError.message };

    // 2. Fetch Users (using God Mode RPC)
    const { data: users, error: usersError } = await supabase
        .rpc('get_tenant_users_secure', { arg_tenant_id: tenantId });

    if (usersError) return { success: false, error: usersError.message };

    return { success: true, tenant, users };
}
