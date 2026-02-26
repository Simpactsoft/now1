
"use server";

import { createClient } from "@/lib/supabase/server";

export async function fetchOrganizations(params: {
    startRow: number;
    endRow: number;
    filterModel: any;
    sortModel: any[];
    tenantId: string;
    query?: string;
}) {
    const { startRow, endRow, filterModel, sortModel, tenantId, query } = params;
    const start = startRow;
    const limit = endRow - startRow;
    const sortCol = sortModel && sortModel.length > 0 ? sortModel[0].colId : 'updated_at';
    const sortDir = sortModel && sortModel.length > 0 ? sortModel[0].sort : 'desc';

    const supabase = await createClient();

    // Helper to extract filter values (supports single object or array of objects)
    const extractFilterValues = (entry: any): string[] | string | null => {
        if (!entry) return null;
        if (Array.isArray(entry)) {
            // Multiple conditions/chips for same field
            return entry.map(e => e.filter || e);
        }
        // Single condition
        return entry.filter || entry;
    };

    // Helper to parse potential multi-select values (comma separated strings)
    // AND now supports array from multiple chips
    const parseMultiSelect = (entry: any) => {
        const raw = extractFilterValues(entry);
        if (!raw) return undefined;

        // If it's already an array (from multiple chips), we might have "A,B" and "C" mixed
        // Let's normalize to a single flat array of strings
        const list = Array.isArray(raw) ? raw : [raw];

        let combined: string[] = [];
        list.forEach(val => {
            if (val && typeof val === 'string' && val.includes(',')) {
                combined.push(...val.split(',').map(s => s.trim()));
            } else if (val) {
                combined.push(val);
            }
        });
        return combined.length > 0 ? combined : undefined;
    };

    const arg_filters: any = {
        search: query || undefined
    };

    // Filters Mapping
    if (filterModel.status) arg_filters.status = parseMultiSelect(filterModel.status.filter);
    if (filterModel.industry) arg_filters.industry = parseMultiSelect(filterModel.industry.filter);
    if (filterModel.company_size) arg_filters.company_size = parseMultiSelect(filterModel.company_size.filter);
    if (filterModel.tags) arg_filters.tags = parseMultiSelect(filterModel.tags.filter);

    try {
        console.log(`[fetchOrganizations] Calling RPC with:`, { tenantId, start, limit, arg_filters });
        const { data, error } = await supabase.rpc('fetch_organizations_crm', {
            arg_tenant_id: tenantId,
            arg_start: start,
            arg_limit: limit,
            arg_sort_col: sortCol,
            arg_sort_dir: sortDir,
            arg_filters: arg_filters
        });

        if (error) {
            console.error("fetchOrganizations RPC Error:", error);
            return { error: error.message };
        }

        console.log(`[fetchOrganizations] RPC Success. Rows: ${data?.length}`);
        const totalCount = data && data.length > 0 ? Number(data[0].ret_total_count) : 0;

        return {
            rowData: data || [],
            rowCount: totalCount
        };

    } catch (e: any) {
        console.error("fetchOrganizations Exception:", e);
        return { error: e.message };
    }
}
