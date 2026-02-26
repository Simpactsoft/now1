import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";
import { getAdminClient, paginatedResponse, errorResponse, getPagination } from "../_utils";

export async function GET(req: NextRequest) {
    const auth = await validateApiKey(req);
    if (auth instanceof NextResponse) return auth;

    const { page, pageSize, startRow, search } = getPagination(req);
    const supabase = getAdminClient();

    const { data, error } = await supabase.rpc("fetch_global_relationships_crm", {
        arg_tenant_id: auth.tenantId,
        arg_start: startRow,
        arg_limit: pageSize,
        arg_sort_col: "created_at",
        arg_sort_dir: "desc",
        arg_filters: search ? { search } : {},
    });

    if (error) return errorResponse(error.message, "DB_ERROR", 500);

    const rows = (data ?? []).map((r: any) => ({
        id: r.ret_id,
        relationship_type: r.rel_type_name,
        source: {
            id: r.source_id,
            name: r.source_name,
            type: r.source_type,
            email: r.source_email ?? null,
        },
        target: {
            id: r.target_id,
            name: r.target_name,
            type: r.target_type,
            email: r.target_email ?? null,
        },
        metadata: r.ret_metadata ?? {},
        created_at: r.ret_created_at,
    }));

    const total = data?.[0]?.ret_total_count ?? 0;
    return paginatedResponse(rows, Number(total), page, pageSize);
}

export async function POST(req: NextRequest) {
    const auth = await validateApiKey(req);
    if (auth instanceof NextResponse) return auth;

    if (!hasScope(auth, "write")) {
        return errorResponse("Write scope required.", "FORBIDDEN", 403);
    }

    let body: any;
    try { body = await req.json(); }
    catch { return errorResponse("Invalid JSON body.", "INVALID_BODY", 400); }

    const { source_id, target_id, relationship_type, metadata } = body;

    if (!source_id) return errorResponse("`source_id` is required.", "VALIDATION_ERROR", 422);
    if (!target_id) return errorResponse("`target_id` is required.", "VALIDATION_ERROR", 422);
    if (!relationship_type) return errorResponse("`relationship_type` is required.", "VALIDATION_ERROR", 422);
    if (source_id === target_id) return errorResponse("`source_id` and `target_id` must be different.", "VALIDATION_ERROR", 422);

    const supabase = getAdminClient();

    // Verify both entities belong to this tenant
    const { data: entities, error: entErr } = await supabase
        .from("cards")
        .select("id")
        .in("id", [source_id, target_id])
        .eq("tenant_id", auth.tenantId);

    if (entErr || !entities || entities.length < 2) {
        return errorResponse("One or both entity IDs not found in your tenant.", "NOT_FOUND", 404);
    }

    // Use the existing RPC that auto-creates the relationship type if needed
    const { data: relId, error } = await supabase.rpc("add_entity_relationship", {
        p_tenant_id: auth.tenantId,
        p_source_id: source_id,
        p_target_id: target_id,
        p_type_name: relationship_type,
    });

    if (error) {
        // Handle duplicate relationship gracefully
        if (error.message?.includes("uniq_entity_link")) {
            return errorResponse(
                "This relationship already exists between these two entities.",
                "DUPLICATE_RELATIONSHIP",
                409
            );
        }
        return errorResponse(error.message, "DB_ERROR", 500);
    }

    // Patch metadata if provided
    if (metadata && typeof metadata === "object") {
        await supabase
            .from("entity_relationships")
            .update({ metadata })
            .eq("id", relId);
    }

    return NextResponse.json(
        {
            data: {
                id: relId,
                source_id,
                target_id,
                relationship_type,
                metadata: metadata ?? {},
            },
        },
        { status: 201 }
    );
}
