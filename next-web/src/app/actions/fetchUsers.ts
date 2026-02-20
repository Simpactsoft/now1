"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

export interface UserProfile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    role: string;
    status: string;
    tenants?: { name: string } | null;
    [key: string]: any;
}

export async function fetchUsers(tenantId: string): Promise<ActionResult<{ users: UserProfile[] }>> {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    try {
        // 1. RBAC Check
        const { data: hasPermission, error: permError } = await supabase
            .rpc('has_permission', { requested_permission: 'users.manage' });

        if (permError || !hasPermission) {
            return actionError("Unauthorized", "AUTH_ERROR");
        }

        // 2. Fetch Profiles (Admin Bypass)
        // We filter by tenant_id to keep multi-tenancy safe even for admins (admin of tenant A shouldn't see tenant B)
        // Although currently our Admin is Global, in future we might restrict.
        const { data: profiles, error: fetchError } = await adminClient
            .from('profiles')
            .select('*, tenants ( name )') // Join with tenants to get name
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (fetchError) {
            return actionError(fetchError.message, "DB_ERROR");
        }

        return actionSuccess({ users: profiles });

    } catch (err: any) {
        return actionError("Failed to fetch users");
    }
}
