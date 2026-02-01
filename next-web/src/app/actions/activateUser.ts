"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function activateUser(userId: string) {
    if (!userId) return;

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
            return;
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
            }
        }
    } catch (err) {
        console.error("ActivateUser: Exception", err);
    }
}
