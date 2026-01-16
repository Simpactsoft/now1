"use server";

import { createClient } from "@/lib/supabase/server";

export interface GridParams {
    startRow?: number;
    endRow?: number;
    sortModel?: { colId: string; sort: "asc" | "desc" }[];
    filterModel?: any;
    tenantId: string;
}

export async function fetchGridData({
    startRow = 0,
    endRow = 100,
    sortModel = [],
    filterModel = {},
    tenantId,
}: GridParams) {
    const supabase = await createClient();
    const startTime = Date.now();

    // 0. Validate tenantId
    if (!tenantId || tenantId === "undefined" || tenantId === "null") {
        console.warn("fetchGridData: Invalid tenantId provided:", tenantId);
        return { rowData: [], rowCount: 0, latency: 0, error: "Invalid Tenant ID" };
    }

    try {
        console.log(`--- fetchGridData() Calling RPC for Tenant ${tenantId} ---`);
        // 1. Prepare sorting and filtering for the RPC
        const sortCol = sortModel.length > 0 ? sortModel[0].colId : "created_at";
        const sortDir = sortModel.length > 0 ? sortModel[0].sort : "desc";

        // Simplified filter (just name for now to match RPC signature)
        const filterName = filterModel.name?.filter || "";

        // 2. Call the Secure Gateway RPC
        const { data, error } = await supabase.rpc("fetch_employees_secure", {
            arg_tenant_id: tenantId,
            arg_start: startRow,
            arg_limit: endRow - startRow,
            arg_sort_col: sortCol,
            arg_sort_dir: sortDir,
            arg_filter_name: filterName
        });

        if (error) {
            console.error("fetch_employees_secure RPC Error:", JSON.stringify(error, null, 2));
            return { rowData: [], rowCount: 0, latency: 0, error: `DB Error: ${error.message}` };
        }

        const rowCount = data && data.length > 0 ? Number(data[0].ret_total_count) : 0;
        const latency = Date.now() - startTime;

        return {
            rowData: data || [],
            rowCount: rowCount,
            latency,
        };
    } catch (err: any) {
        console.error("fetchGridData critical failure:", err);
        return {
            rowData: [],
            rowCount: 0,
            latency: 0,
            error: err?.message || "Internal Server Error",
        };
    }
}
