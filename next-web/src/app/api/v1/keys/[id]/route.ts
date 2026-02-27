import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { getAdminClient, errorResponse } from "../../_utils";

/**
 * DELETE /api/v1/keys/[id]
 * Revoke an API key. Session-authenticated users only.
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = await createSessionClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
        return errorResponse("Session authentication required.", "UNAUTHORIZED", 401);
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

    if (!profile?.tenant_id) {
        return errorResponse("Could not resolve tenant.", "UNAUTHORIZED", 401);
    }

    const admin = getAdminClient();

    // Verify the key belongs to this tenant before revoking
    const { data: key } = await admin
        .from("api_keys")
        .select("id, tenant_id")
        .eq("id", id)
        .eq("tenant_id", profile.tenant_id)
        .single();

    if (!key) {
        return errorResponse("API key not found.", "NOT_FOUND", 404);
    }

    const { error } = await admin
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);

    if (error) return errorResponse(error.message, "DB_ERROR", 500);

    return NextResponse.json({ data: { id, revoked: true } });
}
