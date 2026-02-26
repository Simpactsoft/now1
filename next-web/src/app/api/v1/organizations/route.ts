import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";
import { getAdminClient, paginatedResponse, errorResponse, getPagination } from "../_utils";

export async function GET(req: NextRequest) {
    const auth = await validateApiKey(req);
    if (auth instanceof NextResponse) return auth;

    const { page, pageSize, startRow, search } = getPagination(req);
    const supabase = getAdminClient();

    const { data, error } = await supabase.rpc("fetch_organizations_crm", {
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
        name: r.ret_name,
        status: r.ret_status,
        industry: r.ret_industry,
        company_size: r.ret_company_size,
        email: r.ret_email,
        phone: r.ret_phone,
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

    const { name, email, phone, industry, company_size, tax_id, address, status, custom_fields } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
        return errorResponse("`name` is required.", "VALIDATION_ERROR", 422);
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase.rpc("create_organization", {
        arg_tenant_id: auth.tenantId,
        arg_name: name.trim(),
        arg_email: email ?? null,
        arg_phone: phone ?? null,
        arg_industry: industry ?? null,
        arg_company_size: company_size ?? null,
        arg_tax_id: tax_id ?? null,
        arg_address: address ?? null,
        arg_status: status ?? "PROSPECT",
    });

    if (error) return errorResponse(error.message, "DB_ERROR", 500);

    // If custom_fields provided, patch the card
    if (custom_fields && typeof custom_fields === "object") {
        await supabase
            .from("cards")
            .update({ custom_fields })
            .eq("id", data.id);
    }

    return NextResponse.json({ data }, { status: 201 });
}
