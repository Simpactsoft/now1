"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { ActionResult, actionOk, actionError } from "@/lib/action-result";

export async function activateUser(userId: string): Promise<ActionResult<void>> {
    if (!userId) return actionError("User ID is required", "VALIDATION_ERROR");

    try {
        const adminClient = createAdminClient();

        // 1. Fetch current status to ensure we don't un-suspend someone
        const { data: profile, error: fetchError } = await adminClient
            .from('profiles')
            .select('status')
            .eq('id', userId)
            .single();

        if (fetchError || !profile) {
            console.error("ActivateUser: Failed to fetch profile", fetchError);
            return actionError("Failed to fetch profile", "DB_ERROR");
        }

        // 2. Only activate if 'invited'
        if (profile.status === 'invited') {
            console.log(`ActivateUser: Activating user ${userId}`);
            const { error: updateError } = await adminClient
                .from('profiles')
                .update({ status: 'active' })
                .eq('id', userId);

            if (updateError) {
                console.error("ActivateUser: Update failed", updateError);
                return actionError(updateError.message, "DB_ERROR");
            }
        }

        return actionOk();
    } catch (err: any) {
        console.error("ActivateUser: Exception", err);
        return actionError(err.message || "Unknown error");
    }
}
