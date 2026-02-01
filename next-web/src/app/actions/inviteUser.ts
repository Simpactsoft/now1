"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function inviteUser(email: string, role: 'distributor' | 'dealer' | 'agent', tenantId: string) {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    try {
        // 1. RBAC Check: Must have 'users.manage'
        const { data: hasPermission, error: permError } = await supabase
            .rpc('has_permission', { requested_permission: 'users.manage' });

        if (permError || !hasPermission) {
            return { success: false, error: "Unauthorized: You do not have permission to invite users." };
        }

        // 2. Check if user exists (Optimization to avoid invite error if already active)
        // Actually, inviteUserByEmail handles existing users by sending a magic link, or returns user.
        // But we want to Set Role immediately.

        // 3. Invite User (Supabase Auth)
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
            data: {
                tenant_id: tenantId, // Optional metadata
            }
        });

        if (inviteError) {
            console.error("Invite Error:", inviteError);
            return { success: false, error: inviteError.message };
        }

        const user = inviteData.user;
        if (!user) return { success: false, error: "Failed to create user." };

        // 4. Update Profile Role (Public Table)
        // We use upsert because the 'on_auth_user_created' trigger might not verify/exist, 
        // or we want to ensure specific fields are set immediately.
        const { error: profileError } = await adminClient
            .from('profiles')
            .upsert({
                id: user.id,
                tenant_id: tenantId,
                role: role,
                email: email, // Sync email to profile
                first_name: '', // Placeholder
                last_name: '',   // Placeholder
                status: 'invited'
            });

        if (profileError) {
            console.error("Profile Upsert Failed:", profileError);
            return { success: false, error: "User invited but failed to assign role." };
        }

        revalidatePath("/dashboard/settings/team");
        return { success: true };

    } catch (err: any) {
        console.error("Invite Exception:", err);
        return { success: false, error: "An error occurred." };
    }
}
