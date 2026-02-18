"use server";

import { createClient } from "@/lib/supabase/server";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

export async function fetchTotalStats(tenantId: string): Promise<ActionResult<{ totalPeople: number; totalOrganizations: number }>> {
    try {
        const supabase = await createClient();

        // Count People
        const { count: peopleCount, error: peopleError } = await supabase
            .from('cards')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('type', 'person');

        // Count Organizations
        const { count: orgCount, error: orgError } = await supabase
            .from('cards')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('type', 'organization');

        if (peopleError) console.error("Error fetching people stats:", peopleError);
        if (orgError) console.error("Error fetching org stats:", orgError);

        return actionSuccess({
            totalPeople: peopleCount || 0,
            totalOrganizations: orgCount || 0
        });
    } catch (e: any) {
        return actionError(e.message);
    }
}
