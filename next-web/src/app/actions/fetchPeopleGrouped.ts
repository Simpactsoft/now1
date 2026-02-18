"use server";

import { createClient } from "@/lib/supabase/server";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

export async function fetchPeopleGrouped(tenantId: string, groupField: string): Promise<ActionResult<{ groups: any[] }>> {
    const supabase = await createClient();

    try {
        const { data, error } = await supabase.rpc('get_people_grouped', {
            arg_tenant_id: tenantId,
            arg_group_field: groupField
        });

        if (error) {
            console.error('Group Fetch Error:', error);
            return actionError(error.message, "DB_ERROR");
        }

        return actionSuccess({ groups: data });
    } catch (e: any) {
        return actionError(e.message);
    }
}
