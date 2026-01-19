
import TenantsGrid from "@/components/TenantsGrid";
import { createClient } from "@/lib/supabase/server";
import AddTenantDialog from "@/components/AddTenantDialog";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Platform Admin | NOW System",
};

export default async function AdminPage() {
    const supabase = await createClient();

    // Fetch all Tenants + User Count (God Mode RPC)
    // This allows the Admin Dashboard to see ALL tenants regardless of RLS
    const { data: tenants, error } = await supabase
        .rpc('get_admin_tenants');

    return (
        <div className="flex flex-col gap-8 max-w-7xl mx-auto p-6">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-extrabold tracking-tight gradient-text">
                        Platform Administration
                    </h1>
                    <p className="text-zinc-500 text-sm">
                        Manage all Workspaces and System Settings
                    </p>
                </div>

                <AddTenantDialog />
            </header>

            <TenantsGrid tenants={tenants || []} />

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
                    Error loading tenants: {error.message}
                </div>
            )}
        </div>
    );
}
