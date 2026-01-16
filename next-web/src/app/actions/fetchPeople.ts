"use server";

import { createClient } from "@/lib/supabase/server";

export interface FetchPeopleParams {
    startRow: number;
    endRow: number;
    sortModel: any[];
    filterModel: any;
    tenantId: string;
    query?: string; // Explicit search query bypass
}

export async function fetchPeople(params: FetchPeopleParams) {
    const supabase = await createClient();
    const { startRow, endRow, sortModel, filterModel, tenantId, query } = params;

    // Default sorting
    let sortCol = "updated_at";
    let sortDir = "desc";

    if (sortModel && sortModel.length > 0) {
        sortCol = sortModel[0].colId === 'name' ? 'name' : 'updated_at';
        sortDir = sortModel[0].sort;
    }

    // Default filtering
    // Prioritize explicit 'query' (from Global Search Bar) over grid filterModel
    let filterName = "";
    if (query) {
        filterName = query.trim().replace(/\s+/g, ' ');
    } else if (filterModel && filterModel.name) {
        // Normalize: "  Malka   Omer  " -> "Malka Omer"
        filterName = (filterModel.name.filter || "").trim().replace(/\s+/g, ' ');
    }

    const limit = endRow - startRow;

    const { data, error } = await supabase.rpc("fetch_people_crm", {
        arg_tenant_id: tenantId,
        arg_start: startRow,
        arg_limit: limit,
        arg_sort_col: sortCol,
        arg_sort_dir: sortDir,
        arg_filter_name: filterName,
    });

    if (error) {
        console.error("fetchPeople RPC Error:", error);
        return { rowData: [], rowCount: 0, error: error.message };
    }

    const rowCount = data && data.length > 0 ? Number(data[0].ret_total_count) : 0;

    return {
        rowData: data || [],
        rowCount: rowCount,
        debugInfo: {
            receivedFilter: filterName, // Verify what the server got
            rpcParams: { tenantId, startRow, limit },
            rpcResultCount: data?.length || 0,
            firstRowName: data && data.length > 0 ? data[0].ret_name : 'No Data'
        }
    };
}
