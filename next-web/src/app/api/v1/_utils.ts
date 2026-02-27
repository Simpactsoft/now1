import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";

// Shared service-role client factory for v1 endpoints
export function getAdminClient() {
    return createAdminClient();
}

// Standardized paginated response envelope
export function paginatedResponse(
    data: any[],
    total: number,
    page: number,
    pageSize: number
) {
    return NextResponse.json({
        data,
        meta: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        },
    });
}

// Standardized error response
export function errorResponse(
    message: string,
    code: string,
    status: number = 400
) {
    return NextResponse.json({ error: { code, message } }, { status });
}

// Parse pagination params from URL
export function getPagination(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10))
    );
    const search = searchParams.get("search") ?? "";
    return { page, pageSize, startRow: (page - 1) * pageSize, search };
}
