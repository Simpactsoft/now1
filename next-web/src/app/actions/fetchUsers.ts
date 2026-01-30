"use server";

import { createClient } from "@/lib/supabase/server";

export async function fetchUsers(tenantId: string) {
    try {
        // Use Admin Client to access auth.users
        const { createClient: createAdminClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        // 1. Fetch Profiles for this Tenant
        // We start with profiles because that defines "Membership" in this tenant context
        // (Assuming we want to show only users relevant to this tenant, or checks tenant_id col)
        const { data: profiles, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (profileError) throw profileError;

        if (!profiles || profiles.length === 0) return { users: [] };

        // 2. Fetch Auth Users (to get email, last_sign_in)
        // Admin `listUsers` is paginated, but for < 100 users likely fine. 
        // Better: Map profile IDs to auth IDs.
        // Actually, we can't search auth.users by ID list easily in one go without looping or getting all.
        // Optimization: Get all users (if reasonable size) or loop.
        // For now, let's fetch first 50 users and match? Or just use profiles data if email is synced?
        // Wait, `profiles` table HAS `email` column (denormalized in 93_erp_foundation_schema.sql).
        // So we might not *need* auth.users if the email is kept in sync.
        // Let's verify if `profiles` has email.

        // Let's assume Profile has email (it does in migration 93).
        // Then we just return profiles.
        return { users: profiles };

    } catch (error: any) {
        console.error("fetchUsers Error:", error);
        return { error: error.message };
    }
}
