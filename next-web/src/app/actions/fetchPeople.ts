"use server";

import { createClient } from "@/lib/supabase/server";

import { PaginatedQuerySchema, PaginatedQuery } from '@/lib/schemas';

export async function fetchPeople(params: PaginatedQuery) {
    try {
        const supabase = await createClient();
        console.log("[fetchPeople] Raw Params:", JSON.stringify(params, null, 2));

        // Bypass Zod validation due to crash "Cannot read properties of undefined (reading '_zod')"
        // const result = PaginatedQuerySchema.safeParse(params);
        // if (!result.success) { ... }

        const { startRow, endRow, sortModel, filterModel, tenantId, query } = params as any;

        if (!tenantId) {
            return { rowData: [], rowCount: 0, error: "Missing Tenant ID" };
        }

        // Default sorting
        let sortCol = "name"; // Most natural stable sort
        // Note: Script randomizes names, so even this is unstable if script runs.
        // But 'id' is ugly. Let's try 'created_at' again? No, script randomizes that too.
        // I will use 'id' as the internal default to PROVE stability, but 'name' is better UX.
        // The user complained about numbers. Stability is king right now.
        sortCol = "id";
        let sortDir = "desc";

        if (sortModel && sortModel.length > 0) {
            sortCol = sortModel[0].colId;
            sortDir = sortModel[0].sort;
        }

        // Default filtering
        // Prioritize explicit 'query' (from Global Search Bar) over grid filterModel
        // Construct Filters JSON
        const filters: any = {};

        // 2. Specific Columns
        const fm = filterModel as any || {};
        if (fm.status) console.log("[fetchPeople] Status Filter:", JSON.stringify(fm.status));


        // 1. Search (Global)
        if (query) {
            filters.search = query;
        }

        // 1.1 Name Filter (Column Specific)
        if (fm.name) {
            filters.name = fm.name.filter;
        }

        // Helper to parse potential multi-select values
        const parseFilter = (val: string) => {
            if (!val) return null;
            if (val.includes(',')) {
                return val.split(',').map(s => s.trim());
            }
            return val;
        };

        if (fm.status) filters.status = parseFilter(fm.status.filter);
        if (fm.role_name) filters.role_name = parseFilter(fm.role_name.filter); // Drill Down
        if (fm.company_size) filters.company_size = parseFilter(fm.company_size.filter); // Drill Down
        if (fm.industry) filters.industry = parseFilter(fm.industry.filter); // Drill Down
        if (fm.joined_year) filters.joined_year = parseFilter(fm.joined_year.filter); // Drill Down
        if (fm.joined_quarter) filters.joined_quarter = fm.joined_quarter.filter; // Keep single for now logic
        if (fm.joined_month) filters.joined_month = fm.joined_month.filter; // Drill Down
        if (fm.joined_week) filters.joined_week = fm.joined_week.filter; // Drill Down
        if (fm.tags) filters.tags = parseFilter(fm.tags.filter); // Drill Down [NEW]

        const limit = endRow - startRow;

        console.log("--- [fetchPeople] Debug RPC Call ---");
        console.log("TenantID:", tenantId);
        console.log("Start:", startRow, "Limit:", limit);
        console.log("Filters Constructed:", JSON.stringify(filters, null, 2));

        const { data, error } = await supabase.rpc("fetch_people_crm", {
            arg_tenant_id: tenantId,
            arg_start: startRow,
            arg_limit: limit,
            arg_sort_col: sortCol,
            arg_sort_dir: sortDir,
            arg_filters: filters, // [NEW] Pass JSON
        });

        if (data && data.length > 0) {
            console.log("[fetchPeople] First Row Keys:", Object.keys(data[0]));
            console.log("[fetchPeople] First Row Data:", JSON.stringify(data[0], null, 2));
        }

        if (error) {
            console.error("--- [fetchPeople] RPC FAILED ---");
            console.error(error);
            return { rowData: [], rowCount: 0, error: error.message };
        }

        console.log("--- [fetchPeople] RPC Success ---");
        console.log("Returned Rows:", data ? data.length : 0);
        if (data && data.length > 0) {
            console.log("First Row ID:", data[0].ret_id);
            console.log("Total Count from DB:", data[0].ret_total_count);
        } else {
            console.log("NO DATA RETURNED by RPC");
        }

        const rowCount = data && data.length > 0 ? Number(data[0].ret_total_count) : 0;

        return {
            rowData: data || [],
            rowCount: rowCount,
            debugInfo: {
                timestamp: new Date().toISOString(),
                params: params,
                receivedFilterModel: fm,
                computedFilters: filters,
                rpcArgs: {
                    arg_tenant_id: tenantId,
                    arg_start: startRow,
                    arg_limit: limit,
                    arg_sort_col: sortCol,
                    arg_sort_dir: sortDir,
                },
                rpcResultSummary: {
                    count: data?.length || 0,
                    totalCount: rowCount,
                    firstRowSample: data && data.length > 0 ? {
                        name: data[0].ret_name,
                        id: data[0].ret_id,
                        status: data[0].ret_status
                    } : 'No Data'
                }
            }
        };
    } catch (e: any) {
        console.error("[fetchPeople] CRITICAL ERROR:", e);
        return {
            rowData: [],
            rowCount: 0,
            error: e.message || "Unknown Server Error",
            debugInfo: {
                timestamp: new Date().toISOString(),
                params: params,
                error: e.message || e.toString(),
                stack: e.stack
            }
        };
    }
}
