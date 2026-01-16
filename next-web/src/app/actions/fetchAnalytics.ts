"use server";

import { createClient } from "@/lib/supabase/server";

export async function fetchOrgAnalytics(tenantId: string, basePath: string = "") {
    const supabase = await createClient();
    const startTime = Date.now();

    try {
        const { data, error } = await supabase.rpc("get_org_analytics", {
            p_tenant_id: tenantId,
            p_base_path: basePath,
        });

        if (error) {
            console.error("fetchOrgAnalytics Error:", JSON.stringify(error, null, 2));
            throw error;
        }

        const latency = Date.now() - startTime;
        return { data: data || [], latency };
    } catch (err: any) {
        console.error("fetchOrgAnalytics Critical Failure:", err);
        return { data: [], latency: 0, error: err.message || "Unknown error" };
    }
}

export async function fetchTenantSummary(tenantId: string) {
    const supabase = await createClient();
    const startTime = Date.now();

    try {
        const { data, error } = await supabase.rpc("get_tenant_summary", {
            p_tenant_id: tenantId,
        });

        if (error) {
            console.error("fetchTenantSummary Error:", JSON.stringify(error, null, 2));
            throw error;
        }

        const latency = Date.now() - startTime;
        return { data: data?.[0] || null, latency };
    } catch (err: any) {
        console.error("fetchTenantSummary Critical Failure:", err);
        return { data: null, latency: 0, error: err.message || "Unknown error" };
    }
}
