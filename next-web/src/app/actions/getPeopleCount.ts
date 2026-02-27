"use server";

import { createClient } from "@/lib/supabase/server";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

export async function getPeopleCount(tenantId: string): Promise<ActionResult<number>> {
    if (!tenantId) return actionError("Tenant ID is required", "VALIDATION_ERROR");

    const supabase = await createClient();

    // Use the secure/optimized RPC
    const { data, error } = await supabase.rpc('get_people_count', {
        arg_tenant_id: tenantId,
        arg_filters: {}
    });

    if (error) {
        console.error("Error fetching people count:", JSON.stringify(error, null, 2));
        return actionError(error.message || "Failed to fetch people count", "DB_ERROR");
    }

    return actionSuccess(data || 0);
}
