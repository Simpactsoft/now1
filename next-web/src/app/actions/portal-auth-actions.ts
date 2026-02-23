"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, actionSuccess, ActionResult } from "@/lib/action-result";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Initiates an OTP / Magic Link login process for a portal user.
 */
import { Resend } from "resend";

export async function sendPortalMagicLink(email: string): Promise<ActionResult<{ message: string }>> {
    try {
        if (!email || !email.includes("@")) {
            return actionError("Please provide a valid email address.", "VALIDATION_ERROR");
        }

        const adminClient = createAdminClient();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

        // 1. Generate the magic link securely on the server
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
            options: {
                redirectTo: `${appUrl}/portal/login`, // Our client listener will catch the token hash here
            }
        });

        if (linkError || !linkData.properties?.action_link) {
            console.error("[sendPortalMagicLink] Auth generateLink Error:", linkError);
            if (linkError?.status === 429 || linkError?.message.includes("rate limit")) {
                return actionError("Too many login attempts. Please try again in a few minutes.", "RATE_LIMIT");
            }
            return actionError(linkError?.message || "Failed to generate secure link.", "AUTH_ERROR");
        }

        // 2. Send the email via Resend to bypass Supabase's strict email rate limits
        if (!process.env.RESEND_API_KEY) {
            console.warn("RESEND_API_KEY is not configured. Falling back to console log for magic link.");
            console.log("MAGIC LINK URL:", linkData.properties.action_link);
            return actionSuccess({ message: "Check your console for the login link! (Resend not configured)" });
        }

        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data: emailData, error: emailError } = await resend.emails.send({
            from: "NOW System <hello@resend.dev>", // Should match verified domain
            to: [email],
            subject: "Your Private Portal Login Link",
            html: `
                <div style="font-family: sans-serif; text-align: center; padding: 40px;">
                    <h2>Welcome back to your Portal</h2>
                    <p>Click the button below to securely sign in. This link expires in 24 hours.</p>
                    <br/>
                    <a href="${linkData.properties.action_link}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                        Sign In Now
                    </a>
                    <br/><br/>
                    <p style="font-size: 12px; color: #666;">If you didn't request this email, you can safely ignore it.</p>
                </div>
            `
        });

        if (emailError) {
            console.error("[sendPortalMagicLink] Resend Error:", emailError);
            return actionError("Failed to send login email via provider.", "SEND_ERROR");
        }

        return actionSuccess({ message: "Check your email for the secure login link." });

    } catch (err: any) {
        console.error("sendPortalMagicLink error:", err);
        return actionError(err.message || "An unexpected error occurred.", "UNKNOWN_ERROR");
    }
}

/**
 * Generates a Magic Link URL for a portal user without sending an email directly.
 * Useful for copying the link to send via WhatsApp or other channels.
 */
export async function generatePortalMagicLink(email: string): Promise<ActionResult<{ url: string }>> {
    try {
        if (!email || !email.includes("@")) {
            return actionError("Please provide a valid email address.", "VALIDATION_ERROR");
        }

        const adminClient = createAdminClient();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

        const { data, error } = await adminClient.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
            options: {
                // Point directly to login page so the client component can read the implicit #access_token
                redirectTo: `${appUrl}/portal/login`,
            }
        });

        if (error) {
            console.error("[generatePortalMagicLink] Auth Error:", error);
            return actionError(error.message, "AUTH_ERROR");
        }

        if (!data.properties?.action_link) {
            return actionError("Failed to generate link.", "AUTH_ERROR");
        }

        return actionSuccess({ url: data.properties.action_link });

    } catch (err) {
        console.error("generatePortalMagicLink error:", err);
        return actionError("An unexpected error occurred.", "UNKNOWN_ERROR");
    }
}

/**
 * Initiates a standard Email + Password login process for a portal user.
 */
export async function portalSignInWithPassword(email: string, password: string): Promise<ActionResult<{ message: string }>> {
    try {
        if (!email || !password) {
            return actionError("Please provide both email and password.", "VALIDATION_ERROR");
        }

        const supabase = await createClient();

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error("[portalSignInWithPassword] Auth Error:", error);
            // Don't leak specific error details to the user for security
            return actionError("Invalid email or password.", "AUTH_ERROR");
        }

        // Ideally, we'd check here if they have a portal_users record 
        //, but standard auth middleware will handle blocking them from internal pages.
        return actionSuccess({ message: "Successfully signed in." });

    } catch (err) {
        console.error("portalSignInWithPassword error:", err);
        return actionError("An unexpected error occurred during login.", "UNKNOWN_ERROR");
    }
}

/**
 * ADMIN ONLY: Grants portal access to a customer by creating their auth account 
 * with a specific password and linking it to their CRM card.
 */
export async function grantPortalAccess(input: {
    tenantId: string;
    cardId: string;
    email: string;
    password: string;
}): Promise<ActionResult<{ userId: string }>> {
    try {
        const { tenantId, cardId, email, password } = input;

        if (!email || !password || !tenantId || !cardId) {
            return actionError("Missing required fields for portal access.", "VALIDATION_ERROR");
        }

        if (password.length < 6) {
            return actionError("Password must be at least 6 characters.", "VALIDATION_ERROR");
        }

        const adminClient = createAdminClient();

        // 1. Create or ensure the user exists in auth.users
        let authUserId = "";

        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true // Auto-confirm so they can log in immediately
        });

        if (createError) {
            // If user already exists, we might just update their password instead
            if (createError.message.includes("already registered")) {
                // Fetch existing user to get their ID, and update password
                const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
                const existingUser = listData?.users.find(u => u.email === email);

                if (existingUser) {
                    authUserId = existingUser.id;
                    const { error: updateError } = await adminClient.auth.admin.updateUserById(authUserId, {
                        password: password
                    });
                    if (updateError) {
                        console.error("Failed to update password for existing user", updateError);
                        return actionError("Failed to update password for existing user.", "UPDATE_ERROR");
                    }
                } else {
                    return actionError("User exists but could not be located.", "UNKNOWN_ERROR");
                }
            } else {
                console.error("[grantPortalAccess] Create User Error:", createError);
                return actionError(createError.message, "AUTH_ERROR");
            }
        } else if (newUser.user) {
            authUserId = newUser.user.id;
        }

        if (!authUserId) {
            return actionError("Failed to secure an Auth ID.", "UNKNOWN_ERROR");
        }

        // 2. Link them in `portal_users`
        const { error: linkError } = await adminClient
            .from("portal_users")
            .upsert({
                auth_user_id: authUserId,
                tenant_id: tenantId,
                card_id: cardId
            }, { onConflict: "auth_user_id, tenant_id" });

        if (linkError) {
            console.error("[grantPortalAccess] DB Link Error:", linkError);
            return actionError("Account created, but failed to link to customer record.", "DB_ERROR");
        }

        return actionSuccess({ userId: authUserId });

    } catch (err: any) {
        console.error("grantPortalAccess error:", err);
        return actionError("Unexpected error granting portal access.", "UNKNOWN_ERROR");
    }
}
