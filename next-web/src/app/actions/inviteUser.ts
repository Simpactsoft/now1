"use server";

export async function inviteUser(formData: FormData) {
    try {
        const email = formData.get('email') as string;
        const role = formData.get('role') as string;
        const firstName = formData.get('firstName') as string;
        const lastName = formData.get('lastName') as string;
        const tenantId = formData.get('tenantId') as string;
        const password = formData.get('password') as string; // Optional: for direct creation

        if (!email || !tenantId) return { error: "Missing required fields" };

        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        // 1. Create Auth User
        // If password provided, create directly (verified). Else invite.
        let authUser;
        let authError;

        if (password) {
            const res = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { first_name: firstName, last_name: lastName }
            });
            authUser = res.data.user;
            authError = res.error;
        } else {
            // Invite
            const res = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
                data: { first_name: firstName, last_name: lastName }
            });
            authUser = res.data.user;
            authError = res.error;
        }

        if (authError) throw authError;
        if (!authUser) throw new Error("Failed to create user");

        // 2. Create Profile (Critical Step often missed)
        // We manually insert into 'profiles' to ensure RBAC works immediately.
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: authUser.id,
                tenant_id: tenantId,
                role: role || 'agent',
                first_name: firstName,
                last_name: lastName,
                email: email,
                // org_path will be auto-calculated by trigger if not provided, 
                // but better to default to root if known? 
                // Migration 93 triggers on profiles insert to set org_path if parent missing.
            });

        if (profileError) {
            console.error("Profile creation failed, rolling back auth user (manual cleanup required)", profileError);
            // In real PROD, might want to delete the auth user to keep consistency
            await supabaseAdmin.auth.admin.deleteUser(authUser.id);
            throw profileError;
        }

        return { success: true, userId: authUser.id };

    } catch (error: any) {
        console.error("inviteUser Error:", error);
        return { error: error.message };
    }
}
