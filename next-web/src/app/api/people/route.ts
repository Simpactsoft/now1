
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await req.json();

        const {
            filters = [],
            searchQuery = '',
            sorting = [],
            pagination = { page: 1, pageSize: 50 },
            tenantId
        } = body;

        console.log("[API/People] Request:", { tenantId, searchQuery, pagination });

        if (!tenantId) {
            return NextResponse.json({ error: "Missing Tenant ID" }, { status: 400 });
        }

        // 1. Construct RPC Filters
        const rpcFilters: any = {};

        // Global Search
        if (searchQuery) rpcFilters.search = searchQuery;

        // Field Filters Mapping
        // The RPC expects simple key-value (array) for known fields like status, role_name, etc.
        filters.forEach((f: any) => {
            if (!f.isEnabled) return;
            // Map 'status' -> rpcFilters.status
            if (f.field === 'status' && f.value) {
                // Determine format based on operator, but usually RPC just wants the list of values
                const val = Array.isArray(f.value) ? f.value : [f.value];
                rpcFilters.status = val;
            }
            else if (f.field === 'role' || f.field === 'role_name') {
                const val = Array.isArray(f.value) ? f.value : [f.value];
                // RPC might call it 'role_name' or 'role' - fetchPeople.ts used 'role_name'
                rpcFilters.role_name = val;
            }
            else if (f.field === 'first_name' || f.field === 'name') {
                const val = Array.isArray(f.value) ? f.value : [f.value];
                rpcFilters.name = val;
            }
            else if (f.field === 'tags') {
                const val = Array.isArray(f.value) ? f.value : [f.value];
                rpcFilters.tags = val;
            }
            else if (f.field === 'email') {
                // RPC might not filter email directly in 'arg_filters' unless implemented.
                // If not, we might fall back to client filter or implement specific logic.
                // Assuming 'search' covers email for now, or if RPC supports 'email'.
                // fetchPeople.ts didn't explicitly map email filter, only generic fields.
            }
            // Add other mappings as needed based on what fetch_people_crm supports
        });

        // 2. Pagination & Sorting
        const page = pagination.page || 1;
        const pageSize = pagination.pageSize || 50;
        const startRow = (page - 1) * pageSize;
        const limit = pageSize;

        let sortCol = "created_at";
        let sortDir = "desc";

        if (sorting && sorting.length > 0) {
            // Map frontend sort columns to RPC sort columns
            // generated columns might need mapping
            const field = sorting[0].colId;
            if (field === 'first_name' || field === 'name') sortCol = 'display_name'; // Cards use display_name
            else sortCol = field;

            sortDir = sorting[0].sort;
        }

        console.log("[API/People] RPC Args:", { rpcFilters, sortCol, sortDir, startRow, limit });

        // 3. Call RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc("fetch_people_crm", {
            arg_tenant_id: tenantId,
            arg_start: startRow,
            arg_limit: limit,
            arg_sort_col: sortCol,
            arg_sort_dir: sortDir,
            arg_filters: rpcFilters,
        });

        if (rpcError) {
            console.error("[API/People] RPC Error:", rpcError);
            return NextResponse.json({ error: rpcError.message }, { status: 500 });
        }

        let finalData = rpcData || [];
        // Extract count from first row if available (common pattern in this project)
        let totalRecords = (finalData.length > 0) ? (finalData[0].ret_total_count || 0) : 0;

        // 4. Enrich with Roles (similar to fetchPeople.ts)
        try {
            if (finalData.length > 0) {
                const ids = finalData.map((p: any) => p.ret_id || p.id);
                // The RPC might return 'ret_id', check first item

                const { data: roles, error: roleError } = await supabase
                    .from('party_memberships')
                    .select('person_id, role_name')
                    .in('person_id', ids)
                    .eq('tenant_id', tenantId);

                if (!roleError && roles) {
                    const roleMap = new Map(roles.map((r: any) => [r.person_id, r.role_name]));
                    finalData = finalData.map((p: any) => ({
                        ...p,
                        // Ensure standardized fields for frontend
                        id: p.ret_id || p.id,
                        first_name: p.ret_name ? p.ret_name.split(' ')[0] : (p.display_name ? p.display_name.split(' ')[0] : ''),
                        last_name: p.ret_name ? p.ret_name.split(' ').slice(1).join(' ') : (p.display_name ? p.display_name.split(' ').slice(1).join(' ') : ''),
                        role: roleMap.get(p.ret_id || p.id) || p.ret_role_name || 'contact',
                        status: p.ret_status || p.status,
                        // Extract from nested contact_info if available
                        email: p.ret_contact_info?.email || p.ret_email || p.email,
                        phone: p.ret_contact_info?.phone || p.ret_phone || p.phone,
                        tags: p.ret_tags || p.tags,
                        created_at: p.ret_created_at || p.created_at
                    }));
                }
            }
        } catch (e) {
            console.warn("[API/People] Enrichment failed", e);
        }

        return NextResponse.json({
            data: finalData,
            totalRecords: Number(totalRecords),
            totalPages: Math.ceil(Number(totalRecords) / pageSize),
            page,
            pageSize
        });

    } catch (e: any) {
        console.error("[API/People] Critical Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
