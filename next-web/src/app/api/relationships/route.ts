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

        console.log("[API/Relationships] Request:", { tenantId, searchQuery, pagination });

        if (!tenantId) {
            return NextResponse.json({ error: "Missing Tenant ID" }, { status: 400 });
        }

        // 1. Construct RPC Filters
        const rpcFilters: any = {};

        // Global Search
        if (searchQuery) rpcFilters.search = searchQuery;

        // Field Filters Mapping from SmartChips
        filters.forEach((f: any) => {
            if (!f.isEnabled || !f.value) return;

            const raw = typeof f.value === 'string' ? f.value.split(',').map((s: string) => s.trim()).filter(Boolean) : Array.isArray(f.value) ? f.value : [f.value];

            if (f.field === 'rel_type_name' || f.field === 'type') {
                rpcFilters.type_name = raw;
            } else if (f.field === 'source_type') {
                rpcFilters.source_type = raw;
            } else if (f.field === 'target_type') {
                rpcFilters.target_type = raw;
            }
        });

        // 2. Pagination & Sorting
        const page = pagination.page || 1;
        const pageSize = pagination.pageSize || 50;
        const startRow = (page - 1) * pageSize;
        const limit = pageSize;

        let sortCol = "created_at";
        let sortDir = "desc";

        if (sorting && sorting.length > 0) {
            sortCol = sorting[0].colId;
            sortDir = sorting[0].sort;
        }

        console.log("[API/Relationships] RPC Args:", { rpcFilters, sortCol, sortDir, startRow, limit });

        // 3. Call RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc("fetch_global_relationships_crm", {
            arg_tenant_id: tenantId,
            arg_start: startRow,
            arg_limit: limit,
            arg_sort_col: sortCol,
            arg_sort_dir: sortDir,
            arg_filters: rpcFilters,
        });

        if (rpcError) {
            console.error("[API/Relationships] RPC Error:", rpcError);
            return NextResponse.json({ error: rpcError.message }, { status: 500 });
        }

        let finalData = rpcData || [];
        // Extract count from first row
        let totalRecords = (finalData.length > 0) ? (finalData[0].ret_total_count || 0) : 0;

        // Map RPC result back to a frontend-friendly format matching what the Grid expects
        // (Similar to fetchPeople / fetchOrganizations)
        finalData = finalData.map((row: any) => ({
            id: row.ret_id,
            relationshipId: row.ret_id,
            created_at: row.ret_created_at,
            metadata: row.ret_metadata || {},

            // Source Info
            source_id: row.source_id,
            source_name: row.source_name,
            source_type: row.source_type,
            source_avatar_url: row.source_avatar_url,
            source_email: row.source_email,
            source_phone: row.source_phone,

            // Target Info
            target_id: row.target_id,
            target_name: row.target_name,
            target_type: row.target_type,
            target_avatar_url: row.target_avatar_url,
            target_email: row.target_email,
            target_phone: row.target_phone,

            // Relationship type (the Edge)
            rel_type_name: row.rel_type_name
        }));

        return NextResponse.json({
            data: finalData,
            totalRecords: Number(totalRecords),
            totalPages: Math.ceil(Number(totalRecords) / pageSize),
            page,
            pageSize
        });

    } catch (e: any) {
        console.error("[API/Relationships] Critical Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
