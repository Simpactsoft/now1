"use server";

import { createClient } from "@/lib/supabase/server";

import { PaginatedQuerySchema, PaginatedQuery } from '@/lib/schemas';

export async function fetchGridData(params: PaginatedQuery) {
    const supabase = await createClient();
    const startTime = Date.now();

    // 0. Validate Inputs with Zod
    const validation = PaginatedQuerySchema.safeParse(params);
    if (!validation.success) {
        console.warn("fetchGridData: Validation Failed", validation.error);
        return { rowData: [], rowCount: 0, latency: 0, error: "Invalid Parameters" };
    }
    const { startRow, endRow, sortModel, filterModel, tenantId } = validation.data;

    try {
        console.log(`--- fetchGridData() Calling RPC for Tenant ${tenantId} ---`);
        // 1. Prepare sorting and filtering for the RPC
        const sortCol = sortModel.length > 0 ? sortModel[0].colId : "created_at";
        const sortDir = sortModel.length > 0 ? sortModel[0].sort : "desc";

        // Simplified filter (just name for now to match RPC signature)
        const filterName = filterModel.name?.filter || "";
        // If sorting by name, map to display_name or ret_name
        const rpcSortCol = sortCol === "name" || sortCol === "ret_name" ? "name" : "created_at";


        // 2. Call the Secure Gateway RPC
        const { data, error } = await supabase.rpc("fetch_employees_secure", {
            arg_tenant_id: tenantId,
            arg_start: startRow,
            arg_limit: endRow - startRow,
            arg_sort_col: rpcSortCol,
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
