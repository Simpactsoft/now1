"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

export async function toggleUserStatus(userId: string, currentStatus: string, tenantId: string): Promise<ActionResult<{ newStatus: string }>> {
    try {
        const { createClient: createAdminClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';

        // Update Profile
        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ status: newStatus })
            .eq('id', userId)
            .eq('tenant_id', tenantId); // Safety check

        if (error) throw error;

        // Optional: If suspending, we might want to kill their sessions?
        // Supabase Auth doesn't have a direct "kill session" for specific user via Admin API easily
        // without ban, but modifying the user_metadata or banning is an option.
        // For now, we rely on App Logic checking 'status' in middleware or on load.

        if (newStatus === 'suspended') {
            // Let's also "Ban" them in Auth to fully block access immediately
            // await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "100y" });
            // Wait, ban is harsh. Let's start with just profile status which our app respects.
        }

        revalidatePath('/dashboard/settings/team');
        return actionSuccess({ newStatus });

    } catch (error: any) {
        console.error("toggleUserStatus Error:", error);
        return actionError(error.message);
    }
}
