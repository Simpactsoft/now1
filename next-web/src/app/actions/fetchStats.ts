"use server";

import { createClient } from "@/lib/supabase/server";

export async function fetchTotalStats(tenantId: string) {
    try {
        const supabase = await createClient();

        // Count all people for this tenant (unfiltered)
        const { count, error } = await supabase
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
