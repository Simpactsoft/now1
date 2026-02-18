"use server";

import { createClient } from "@/lib/supabase/server";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

export async function fetchTenantDetails(tenantId: string): Promise<ActionResult<{ tenant: any; users: any[] }>> {
    const supabase = await createClient();

    // 1. Fetch Tenant Metadata (using God Mode RPC)
    const { data: tenant, error: tenantError } = await supabase
        .rpc('get_admin_tenant', { arg_tenant_id: tenantId })
        .single();

    if (tenantError) return actionError(tenantError.message, "DB_ERROR");

    // 2. Fetch Users (using God Mode RPC)
    const { data: users, error: usersError } = await supabase
        .rpc('get_tenant_users_secure', { arg_tenant_id: tenantId });

    if (usersError) return actionError(usersError.message, "DB_ERROR");

    return actionSuccess({ tenant, users });
}
