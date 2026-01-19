"use server";

import { createClient } from "@/lib/supabase/server";

export async function fetchPeopleGrouped(tenantId: string, groupField: string) {
    const supabase = await createClient();

    try {
        const { data, error } = await supabase.rpc('get_people_grouped', {
            arg_tenant_id: tenantId,
            arg_group_field: groupField
        });

        if (error) {
            console.error('Group Fetch Error:', error);
            return { error: error.message };
        }

        return { groups: data };
    } catch (e: any) {
        return { error: e.message };
    }
}
