"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionResult, actionOk, actionError } from "@/lib/action-result";

export async function updateTeamMemberPassword(userId: string, targetPassword: string): Promise<ActionResult<void>> {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    try {
        // 1. RBAC Check: Must have 'users.manage' to change team passwords
        const { data: hasPermission, error: permError } = await supabase
            .rpc('has_permission', { requested_permission: 'users.manage' });

        if (permError || !hasPermission) {
            return actionError("Unauthorized: You do not have permission to manage users.", "AUTH_ERROR");
        }

        // 2. Validate Password
        if (!targetPassword || targetPassword.length < 6) {
            return actionError("Password must be at least 6 characters.", "VALIDATION_ERROR");
        }

        // 3. Update Password via Admin API
        const { data, error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
            password: targetPassword
        });

        if (updateError) {
            console.error("[updateTeamMemberPassword] Error:", updateError);
            return actionError(updateError.message, "AUTH_ERROR");
        }

        // Ensure user is confirmed if we are setting a password directly for them
        if (!data.user.email_confirmed_at) {
            await adminClient.auth.admin.updateUserById(userId, {
                email_confirm: true
            });
        }

        return actionOk();

    } catch (err: any) {
        console.error("updateTeamMemberPassword Exception:", err);
        return actionError("An unexpected error occurred.");
    }
}
