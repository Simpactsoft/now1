
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const cookieStore = await cookies();

    let tenantId = req.nextUrl.searchParams.get("tenantId");
    if (!tenantId) {
        tenantId = cookieStore.get("tenant_id")?.value || "";
    }

    if (!tenantId) {
        return NextResponse.json({ error: "No Tenant ID found in cookies or params" });
    }

    // Call RPC directly like route.ts
    const { data: rpcData, error: rpcError } = await supabase.rpc("fetch_people_crm", {
        arg_tenant_id: tenantId,
        arg_start: 0,
        arg_limit: 10,
        arg_sort_col: "created_at",
        arg_sort_dir: "desc",
        arg_filters: {}, // Empty filters
    });

    return NextResponse.json({
        tenantId,
        rpcError,
        rpcDataCount: rpcData?.length,
        firstRow: rpcData?.[0]
    });
}
