import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export interface ApiAuthResult {
    tenantId: string;
    keyId: string;
    scopes: string[];
}

/**
 * Validates an API key from the Authorization header.
 * Uses service_role to bypass RLS so we can look up keys from any tenant.
 *
 * Returns ApiAuthResult on success, or NextResponse (401/403) on failure.
 */
export async function validateApiKey(
    req: NextRequest
): Promise<ApiAuthResult | NextResponse> {
    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json(
            { error: { code: "MISSING_API_KEY", message: "Authorization header with Bearer token required." } },
            { status: 401 }
        );
    }

    const rawKey = authHeader.slice(7).trim(); // strip "Bearer "

    if (!rawKey.startsWith("nw_")) {
        return NextResponse.json(
            { error: { code: "INVALID_API_KEY_FORMAT", message: "Invalid API key format." } },
            { status: 401 }
        );
    }

    // Hash the raw key with SHA-256
    const keyHash = await hashApiKey(rawKey);

    // Use service_role client so we can query regardless of RLS
    const supabaseAdmin = createAdminClient();

    const { data: apiKey, error } = await supabaseAdmin
        .from("api_keys")
        .select("id, tenant_id, is_active")
        .eq("api_key_hash", keyHash)
        .single();

    if (error || !apiKey) {
        return NextResponse.json(
            { error: { code: "INVALID_API_KEY", message: "API key not found or invalid." } },
            { status: 401 }
        );
    }

    if (!apiKey.is_active) {
        return NextResponse.json(
            { error: { code: "REVOKED_API_KEY", message: "This API key has been revoked." } },
            { status: 401 }
        );
    }

    // Update last_used_at asynchronously (fire-and-forget, don't block the request)
    supabaseAdmin
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", apiKey.id)
        .then(() => { });

    return {
        tenantId: apiKey.tenant_id,
        keyId: apiKey.id,
        scopes: ["read", "write"],
    };
}

/**
 * Check whether an auth result has a specific scope.
 */
export function hasScope(auth: ApiAuthResult, scope: string): boolean {
    return auth.scopes.includes(scope) || auth.scopes.includes("admin");
}

/**
 * Hash a raw API key using SHA-256 (Web Crypto API – available in Edge & Node).
 */
export async function hashApiKey(rawKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a new API key.
 * Returns { rawKey, keyHash, keyPrefix }
 * The rawKey is the full key shown only once.
 */
export async function generateApiKey(): Promise<{
    rawKey: string;
    keyHash: string;
    keyPrefix: string;
}> {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const randomHex = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    const rawKey = `nw_live_sk_${randomHex}`;
    const keyHash = await hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 20); // "nw_live_sk_" + 9 chars

    return { rawKey, keyHash, keyPrefix };
}
