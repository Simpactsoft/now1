
import TenantsGrid from "@/components/TenantsGrid";
import { createClient } from "@/lib/supabase/server";
import AddTenantDialog from "@/components/AddTenantDialog";
import { Users } from "lucide-react";

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
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-extrabold tracking-tight gradient-text">
                        Platform Administration
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Manage all Workspaces and System Settings
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Team Settings Link */}
                    <a href="/dashboard/settings/team" className="flex flex-col bg-card hover:bg-accent/50 p-6 rounded-2xl border border-border transition-colors group">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                                <Users className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">Add users, assign roles (Distributor/Agent), and manage access.</p>
                    </a>

                    <AddTenantDialog />
                </div>
            </header>

            <TenantsGrid tenants={tenants || []} />

            {error && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
                    Error loading tenants: {error.message}
                </div>
            )}
        </div>
    );
}
