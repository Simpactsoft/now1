import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { getAdminClient, errorResponse } from "../_utils";
import { generateApiKey } from "@/lib/api-auth";

/**
 * GET /api/v1/keys
 * List all API keys for this tenant (session-authenticated users only, not API key auth).
 */
export async function GET(req: NextRequest) {
    const supabase = await createSessionClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
        return errorResponse("Session authentication required to manage API keys.", "UNAUTHORIZED", 401);
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
    const { data, error } = await admin
        .from("api_keys")
        .select("id, name, key_prefix, scopes, created_at, last_used_at, revoked_at")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

    if (error) return errorResponse(error.message, "DB_ERROR", 500);

    return NextResponse.json({
        data: (data ?? []).map((k) => ({
            id: k.id,
            name: k.name,
            key_preview: `${k.key_prefix}...`,  // Never expose full key
            scopes: k.scopes,
            created_at: k.created_at,
            last_used_at: k.last_used_at,
            is_active: !k.revoked_at,
        })),
    });
}

/**
 * POST /api/v1/keys
 * Generate a new API key for this tenant (session-authenticated users only).
 * Returns the raw key ONCE – it cannot be retrieved again.
 */
export async function POST(req: NextRequest) {
    const supabase = await createSessionClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
        return errorResponse("Session authentication required to manage API keys.", "UNAUTHORIZED", 401);
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

    if (!profile?.tenant_id) {
        return errorResponse("Could not resolve tenant.", "UNAUTHORIZED", 401);
    }

    let body: any = {};
    try { body = await req.json(); } catch { }

    const name = body.name?.trim() || "API Key";
    const scopes = body.scopes ?? ["read", "write"];

    // Validate scopes
    const validScopes = ["read", "write", "admin"];
    for (const s of scopes) {
        if (!validScopes.includes(s)) {
            return errorResponse(`Invalid scope "${s}". Valid scopes: ${validScopes.join(", ")}`, "VALIDATION_ERROR", 422);
        }
    }

    const { rawKey, keyHash, keyPrefix } = await generateApiKey();

    const admin = getAdminClient();
    const { data, error } = await admin
        .from("api_keys")
        .insert({
            tenant_id: profile.tenant_id,
            name,
            key_hash: keyHash,
            key_prefix: keyPrefix,
            scopes,
        })
        .select("id, name, scopes, created_at")
        .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 500);

    return NextResponse.json(
        {
            data: {
                id: data.id,
                name: data.name,
                scopes: data.scopes,
                created_at: data.created_at,
                // RAW KEY – shown ONCE only. Store it securely.
                key: rawKey,
                key_preview: `${keyPrefix}...`,
            },
            meta: {
                warning: "Save this API key now. It will NOT be shown again.",
            },
        },
        { status: 201 }
    );
}
