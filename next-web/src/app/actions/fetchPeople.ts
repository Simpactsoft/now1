"use server";

import { createClient } from "@/lib/supabase/server";
import { PaginatedQuerySchema, PaginatedQuery } from '@/lib/schemas';

export async function fetchPeople(params: PaginatedQuery) {
    try {
        const supabase = await createClient();

        console.log("[fetchPeople] Fetching with Standard Client (RLS Active). Tenant:", params.tenantId);

        const { startRow, endRow, sortModel, filterModel, tenantId, query } = params as any;

        if (!tenantId) {
            return { rowData: [], rowCount: 0, error: "Missing Tenant ID" };
        }

        // Default sorting
        let sortCol = "created_at"; // Show newest first by default
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


        // Helper to extract filter values (supports single object or array of objects)
        const extractFilterValues = (entry: any): string[] | string | null => {
            if (!entry) return null;
            if (Array.isArray(entry)) {
                // Multiple conditions/chips for same field
                return entry.map(e => e.filter);
            }
            // Single condition
            return entry.filter;
        };

        // Helper to parse potential multi-select values (comma separated strings)
        // AND now supports array from multiple chips
        const parseMultiSelect = (entry: any) => {
            const raw = extractFilterValues(entry);
            if (!raw) return null;

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
            return combined.length > 0 ? combined : null;
        };

        // 1. Search (Global)
        if (query) {
            filters.search = query;
        }

        // 1.1 Name Filter (Column Specific)
        if (fm.name) filters.name = parseMultiSelect(fm.name);

        if (fm.status) filters.status = parseMultiSelect(fm.status);
        if (fm.role_name) filters.role_name = parseMultiSelect(fm.role_name);
        if (fm.company_size) filters.company_size = parseMultiSelect(fm.company_size);
        if (fm.industry) filters.industry = parseMultiSelect(fm.industry);
        if (fm.joined_year) filters.joined_year = parseMultiSelect(fm.joined_year);
        if (fm.joined_quarter) filters.joined_quarter = extractFilterValues(fm.joined_quarter);
        if (fm.joined_month) filters.joined_month = extractFilterValues(fm.joined_month);
        if (fm.joined_week) filters.joined_week = extractFilterValues(fm.joined_week);
        if (fm.tags) filters.tags = parseMultiSelect(fm.tags);

        const limit = endRow - startRow;

        console.log("--- [fetchPeople] Debug RPC Call ---");
        console.log("TenantID:", tenantId);
        console.log("Start:", startRow, "Limit:", limit);
        console.log("Filters Constructed:", JSON.stringify(filters, null, 2));

        // OPTIMIZATION: Run Data and Count in parallel only if needed
        // If startRow > 0, we don't strictly need count again if the client tracks it
        const shouldFetchCount = startRow === 0;

        // [Production] Using the optimized RPC (Partitioned + Indexed)
        // Using standard 'supabase' client to respect RLS
        const dataPromise = supabase.rpc("fetch_people_crm", {
            arg_tenant_id: tenantId,
            arg_start: startRow,
            arg_limit: endRow - startRow,
            arg_sort_col: sortCol,
            arg_sort_dir: sortDir,
            arg_filters: filters,
        });

        // Loop: Count is now returned inside the main query (no second RPC needed usually, but logic kept for structure)
        const countPromise = Promise.resolve({ data: 0, error: null });

        const [dataResult, countResult] = await Promise.all([dataPromise, countPromise]);

        if (dataResult.error) {
            console.error("--- [fetchPeople] Data RPC FAILED ---");
            console.error(dataResult.error);
            return { rowData: [], rowCount: 0, error: dataResult.error.message };
        }

        if (shouldFetchCount && countResult.error) {
            console.warn("--- [fetchPeople] Count RPC Failed (Non-fatal) ---", countResult.error);
        }

        let finalData = dataResult.data || [];
        // [Optimized] Count is returned in the row itself as 'ret_total_count'
        let rowCount = (finalData.length > 0) ? (finalData[0].ret_total_count || 0) : 0;

        if (finalData.length > 0) {
            // [Production] Fetch Roles (Optional - can be optimized later)
            try {
                // Use 'ret_id' (RPC now returns this alias)
                const ids = finalData.map((p: any) => p.ret_id);

                // Fetch roles for these people (limit 1 per person effectively via application logic, or just take first)
                const { data: roles, error: roleError } = await supabase
                    .from('party_memberships')
                    .select('person_id, role_name')
                    .in('person_id', ids)
                    .eq('tenant_id', tenantId);

                if (!roleError && roles) {
                    const roleMap = new Map(roles.map((r: any) => [r.person_id, r.role_name]));

                    // Attach role to data
                    finalData = finalData.map((p: any) => ({
                        ...p,
                        ret_role_name: roleMap.get(p.ret_id) || p.ret_role_name || 'contact'
                    }));
                }
            } catch (roleErr) {
                console.warn("Failed to fetch roles enhancement:", roleErr);
            }
        }

        return {
            rowData: finalData,
            rowCount: Number(rowCount)
        };

    } catch (err: any) {
        console.error("[fetchPeople] Critical Error:", err);
        return { rowData: [], rowCount: 0, error: "Internal Server Error" };
    }
}
