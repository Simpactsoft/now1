import { cookies } from "next/headers";
import PeopleViewWrapper from "@/components/PeopleViewWrapper";
import TenantSwitcher from "@/components/TenantSwitcher";
import AddPersonDialog from "@/components/AddPersonDialog";
import { Suspense } from "react";
import DashboardWrapper from "@/components/DashboardWrapper"; // Reusing or replacing wrapper logic
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "CRM Contacts | NOW System",
    description: "Manage all people and prospects",
};

export default async function PeoplePage() {
    const cookieStore = await cookies();
    const tenantId = cookieStore.get("tenant_id")?.value;

    let countDisplay = "0";

    if (tenantId) {
        // [FIX] Use RPC instead of direct select to bypass RLS issues
        const supabase = await createClient();
        const { data, error } = await supabase.rpc("fetch_people_crm", {
            arg_tenant_id: tenantId,
            arg_start: 0,
            arg_limit: 1,
            arg_sort_col: 'updated_at',
            arg_sort_dir: 'desc',
            arg_filters: {}
        });

        if (!error && data && data.length > 0) {
            countDisplay = Number(data[0].ret_total_count).toLocaleString();
        }
    }

    return (
        <div className="flex flex-col gap-8">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
                <div className="flex flex-col gap-1">
                    <h1 className="text-4xl font-extrabold tracking-tight gradient-text">
                        CRM Contacts
                    </h1>
                    <p className="text-zinc-500 text-sm">
                        Total Database: {countDisplay} Identities (Prospects & Active)
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    <AddPersonDialog tenantId={tenantId ?? ""} />
                </div>
            </header>

            {!tenantId ? (
                <div className="flex flex-col items-center justify-center min-h-[500px] border border-dashed border-white/10 rounded-3xl bg-white/5">
                    <p className="text-zinc-400 font-medium">Please select a tenant to view contacts</p>
                </div>
            ) : (
                <div className="glass rounded-2xl p-4">
                    <PeopleViewWrapper tenantId={tenantId} />
                </div>
            )}
        </div>
    );
}
