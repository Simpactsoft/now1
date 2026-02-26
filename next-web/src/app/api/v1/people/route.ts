import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";
import { getAdminClient, paginatedResponse, errorResponse, getPagination } from "../_utils";

export async function GET(req: NextRequest) {
    const auth = await validateApiKey(req);
    if (auth instanceof NextResponse) return auth;

    const { page, pageSize, startRow, search } = getPagination(req);
    const supabase = getAdminClient();

    const { data, error } = await supabase.rpc("fetch_people_crm", {
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
        first_name: r.ret_name?.split(" ")[0] ?? "",
        last_name: r.ret_name?.split(" ").slice(1).join(" ") ?? "",
        name: r.ret_name,
        status: r.ret_status,
        email: r.ret_contact_info?.email ?? r.ret_email ?? null,
        phone: r.ret_contact_info?.phone ?? r.ret_phone ?? null,
        tags: r.ret_tags,
        custom_fields: r.ret_custom_fields,
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

    const { first_name, last_name, email, phone, status, tags, custom_fields } = body;

    if (!first_name || typeof first_name !== "string" || first_name.trim().length === 0) {
        return errorResponse("`first_name` is required.", "VALIDATION_ERROR", 422);
    }
    if (!last_name || typeof last_name !== "string" || last_name.trim().length === 0) {
        return errorResponse("`last_name` is required.", "VALIDATION_ERROR", 422);
    }

    const supabase = getAdminClient();
    const displayName = `${first_name.trim()} ${last_name.trim()}`.trim();

    // Build contact_methods JSONB
    const contactMethods: Record<string, string> = {};
    if (email) contactMethods.email = email;
    if (phone) contactMethods.phone = phone;

    // Insert directly into cards table (bypasses create_person RPC which requires auth.uid())
    const { data, error } = await supabase
        .from("cards")
        .insert({
            tenant_id: auth.tenantId,
            type: "person",
            display_name: displayName,
            contact_methods: contactMethods,
            custom_fields: custom_fields ?? {},
            tags: tags ?? [],
            status: (status ?? "lead").toLowerCase(),
            hierarchy_path: "org",
        })
        .select("id, display_name, contact_methods, status, tags, created_at")
        .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 500);

    return NextResponse.json({
        data: {
            id: data.id,
            display_name: data.display_name,
            email: data.contact_methods?.email ?? null,
            phone: data.contact_methods?.phone ?? null,
            status: data.status,
            tags: data.tags,
            created_at: data.created_at,
        }
    }, { status: 201 });
}
