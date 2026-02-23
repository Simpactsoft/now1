"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";
import { actionError, actionSuccess, ActionResult } from "@/lib/action-result";
import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";

const PORTAL_COOKIE_NAME = "portal_session";

// ----------------------------------------------------------------------
// Agent Actions (Creating Links)
// ----------------------------------------------------------------------

/**
 * Generates a secure shareable portal link for a specific CRM card.
 * @param tenantId The current workspace tenant ID
 * @param cardId The CRM customer card ID
 * @returns The absolute URL to the portal login page with the secure token
 */
export async function generatePortalTokenAction(tenantId: string, entityIdOrCardId: string): Promise<ActionResult<string>> {
    // 1. Verify the agent is authorized to generate links for this tenant
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return actionError("Unauthorized", "UNAUTHORIZED");

    const adminClient = createAdminClient();

    // 1.5 Resolve to strictly a `cards.id`. Since `parties` no longer exists, entityIdOrCardId MUST be `cards.id`.
    const { data: cardRes, error: cardErr } = await adminClient
        .from('cards')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('id', entityIdOrCardId)
        .limit(1);

    if (cardErr || !cardRes || cardRes.length === 0) {
        console.error("Failed to resolve card ID for portal token:", entityIdOrCardId, cardErr);
        return actionError("Target customer record not found. Cannot generate link.");
    }

    const strictlyCardId = cardRes[0].id;

    // 2. Generate a secure random token (the secret the user will click)
    const rawToken = randomBytes(32).toString('hex');
    // We store the SHA-256 hash in the DB so that if the DB is compromised, active links aren't immediately usable
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    // 3. Set expiration (e.g., 14 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    // 4. Insert into the database
    const { error } = await adminClient.from('portal_tokens').insert({
        token_hash: tokenHash,
        tenant_id: tenantId,
        card_id: strictlyCardId,
        created_by: auth.userId,
        expires_at: expiresAt.toISOString()
    });

    if (error) {
        console.error("Failed to insert portal token:", error);
        return actionError("Failed to generate secure link");
    }

    // 5. Construct the absolute public URL
    // Try to use the configured deployment URL, fallback to localhost for dev
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // We send the RAW token in the URL. The server will hash it to verify.
    const shareableLink = `${baseUrl}/portal/login?token=${rawToken}`;
    return actionSuccess(shareableLink);
}

// ----------------------------------------------------------------------
// Portal User Actions (Validating and Sessions)
// ----------------------------------------------------------------------

/**
 * Verifies a token from the URL, and if valid, sets the secure cookie session.
 * @param rawToken The plain token from the `?token=` URL parameter
 */
export async function verifyPortalTokenAndLogin(rawToken: string): Promise<ActionResult<void>> {
    if (!rawToken || rawToken.length < 32) {
        return actionError("Invalid or missing portal token", "INVALID_TOKEN");
    }

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const adminClient = createAdminClient();

    // 1. Lookup the token
    const { data: tokens, error } = await adminClient
        .from('portal_tokens')
        .select('id, card_id, tenant_id, expires_at')
        .eq('token_hash', tokenHash)
        .limit(1);

    if (error || !tokens || tokens.length === 0) {
        return actionError("This portal link is invalid or has been revoked.", "INVALID_TOKEN");
    }

    const tokenRecord = tokens[0];

    // 2. Check expiration
    if (new Date(tokenRecord.expires_at) < new Date()) {
        return actionError("This portal link has expired. Please request a new one.", "EXPIRED_TOKEN");
    }

    // 3. Set the cookie payload
    const sessionPayload = {
        card_id: tokenRecord.card_id,
        tenant_id: tokenRecord.tenant_id,
        auth_time: Date.now()
    };

    // 4. Save to secure HttpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set({
        name: PORTAL_COOKIE_NAME,
        value: JSON.stringify(sessionPayload),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 14, // 14 days
        path: '/portal', // Restrict cookie to portal routes only
    });

    return actionSuccess(undefined);
}

/**
 * Helper strictly for Server Actions/Routes inside the /portal folder
 * to securely extract the authenticated card ID and tenant.
 */
export async function getPortalSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(PORTAL_COOKIE_NAME);

    if (!sessionCookie || !sessionCookie.value) {
        return null;
    }

    try {
        const payload = JSON.parse(sessionCookie.value);
        if (!payload.card_id || !payload.tenant_id) return null;

        return {
            cardId: payload.card_id as string,
            tenantId: payload.tenant_id as string
        };
    } catch (e) {
        console.error("Failed to parse portal session cookie", e);
        return null;
    }
}

/**
 * Logs out the portal user by deleting the cookie.
 */
export async function portalLogoutAction(): Promise<ActionResult<void>> {
    const cookieStore = await cookies();
    cookieStore.delete({
        name: PORTAL_COOKIE_NAME,
        path: '/portal'
    });
    return actionSuccess(undefined);
}
