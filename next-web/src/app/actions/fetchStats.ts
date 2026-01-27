"use server";

import { createClient } from "@/lib/supabase/server";

export async function fetchTotalStats(tenantId: string) {
    try {
        // Use Admin to ensure accurate count regardless of RLS
        const { createClient: createAdminClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        // Count all people for this tenant (unfiltered)
        const { count, error } = await supabaseAdmin
            .from('cards')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('type', 'person');

        if (error) {
            console.error("Error fetching total stats:", error);
            return { totalPeople: 0, error: error.message };
        }

        return { totalPeople: count || 0 };
    } catch (e: any) {
        return { totalPeople: 0, error: e.message };
    }
}
