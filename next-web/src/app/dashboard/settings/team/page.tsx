import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UserManagement from "@/components/UserManagement";
import BackButton from "@/components/BackButton";

export default async function TeamSettingsPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Get Profile for Tenant ID
    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

    if (!profile) {
        return <div>Access Denied</div>;
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-6 flex items-center gap-4">
                <BackButton fallbackUrl="/dashboard" label="Back to Dashboard" />
                <h1 className="text-2xl font-bold">Team Settings</h1>
            </div>

            <UserManagement tenantId={profile.tenant_id} />
        </div>
    );
}
