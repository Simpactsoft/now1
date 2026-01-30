"use server";

import { createClient } from "@/lib/supabase/server";

export async function fetchAuditLogs(
    tenantId: string,
    page: number = 0,
    pageSize: number = 50
) {
    const supabase = await createClient();

    const from = page * pageSize;
    const to = from + pageSize - 1;

    // Fetch logs + Actor Name (using profiles join)
    const { data, count, error } = await supabase
        .from('audit_logs')
        .select(`
        *,
        actor:performed_by (
            first_name,
            last_name,
            email
        )
    `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        console.error("Error fetching audit logs:", error);
        return { data: [], count: 0, error: error.message };
    }

    return { data, count };
}
