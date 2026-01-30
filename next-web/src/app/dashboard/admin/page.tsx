
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Team Settings Link */}
                    <a href="/dashboard/settings/team" className="glass p-6 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-200">Team Members</h3>
                        </div>
                        <p className="text-sm text-zinc-500">Add users, assign roles (Distributor/Agent), and manage access.</p>
                    </a>

                    <AddTenantDialog />
                </div>
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
