"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPeopleCount(tenantId: string) {
    if (!tenantId) return 0;

    const supabase = await createClient();

    // Use the secure/optimized RPC
    const { data, error } = await supabase.rpc('get_people_count', {
        arg_tenant_id: tenantId,
        arg_filters: {}
    });

    if (error) {
        console.error("Error fetching people count:", error);
        return 0;
    }

    return data || 0;


}
