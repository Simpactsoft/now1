"use server";

import { createClient } from "@/lib/supabase/server";

import { PaginatedQuerySchema, PaginatedQuery } from '@/lib/schemas';

export async function fetchPeople(params: PaginatedQuery) {
    try {
        const supabase = await createClient();

        // [Fix] Use Service Role (Admin) for manual fetches to ensure we get data regardless of RLS
        // RPC might return data that standard Select hides if policies mismatch.
        const { createClient: createAdminClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        console.log("[fetchPeople] Raw Params:", JSON.stringify(params, null, 2));

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

        // 1. Search (Global)
        if (query) {
            filters.search = query;
        }

        // 1.1 Name Filter (Column Specific)
        if (fm.name) filters.name = extractFilterValues(fm.name);

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

        const { data, error } = await supabase.rpc("fetch_people_crm", {
            arg_tenant_id: tenantId,
            arg_start: startRow,
            arg_limit: limit,
            arg_sort_col: sortCol,
            arg_sort_dir: sortDir,
            arg_filters: filters, // [NEW] Pass JSON
        });

        if (error) {
            console.error("--- [fetchPeople] RPC FAILED ---");
            console.error(error);
            return { rowData: [], rowCount: 0, error: error.message };
        }

        let finalData = data || [];
        let rowCount = finalData.length > 0 ? Number(finalData[0].ret_total_count) : 0;

        if (finalData.length > 0) {
            console.log("[fetchPeople] First Row Keys:", Object.keys(finalData[0]));
            // console.log("[fetchPeople] First Row Data:", JSON.stringify(finalData[0], null, 2));

            // [Workaround] Fetch Roles manually since RPC doesn't return them yet
            try {
                const ids = finalData.map((p: any) => p.ret_id);

                // Fetch roles for these people (limit 1 per person effectively via application logic, or just take first)
                const { data: roles, error: roleError } = await supabaseAdmin
                    .from('party_memberships')
                    .select('person_id, role_name')
                    .in('person_id', ids)
                    .eq('tenant_id', tenantId);

                if (!roleError && roles) {
                    const roleMap = new Map();
                    roles.forEach((r: any) => {
                        // Assuming one primary role, or just taking the last one found
                        roleMap.set(r.person_id, r.role_name);
                    });

                    // [New] Also fetch custom_fields from parties as fallback for standalone contacts
                    const { data: partyData, error: partyError } = await supabaseAdmin
                        .from('parties')
                        .select('id, custom_fields')
                        .in('id', ids)
                        .eq('tenant_id', tenantId);

                    const partyRoleMap = new Map();
                    if (!partyError && partyData) {
                        partyData.forEach((p: any) => {
                            if (p.custom_fields && p.custom_fields.role) {
                                partyRoleMap.set(p.id, p.custom_fields.role);
                            }
                        });
                    }

                    console.log("[fetchPeople] Manual Role Fetch Debug:");
                    console.log("IDs:", ids.length);
                    console.log("Membership Roles Found:", roleMap.size);
                    console.log("Custom Field Roles Found:", partyRoleMap.size);
                    // Log a sample if available
                    if (partyRoleMap.size > 0) {
                        console.log("Sample CF Role Key:", [...partyRoleMap.keys()][0], "Value:", [...partyRoleMap.values()][0]);
                    }

                    finalData.forEach((p: any) => {
                        // Priority: Membership Role > Custom Fields Role > Null
                        p.ret_role_name = roleMap.get(p.ret_id) || partyRoleMap.get(p.ret_id) || null;
                    });
                }
                
                // Log success
                console.log("[fetchPeople] Roles Merged. Count:", roles?.length);

            } catch (err) {
                console.error("Error fetching roles manually", err);
                // If manual fetch fails, proceed with original data
            }
        } else {
            console.log("--- [fetchPeople] RPC Success (Empty) ---");
        }

        return {
            rowData: finalData,
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
                    count: finalData.length,
                    totalCount: rowCount,
                    firstRowSample: finalData.length > 0 ? {
                        name: finalData[0].ret_name,
                        id: finalData[0].ret_id,
                        status: finalData[0].ret_status,
                        role: finalData[0].ret_role_name
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
