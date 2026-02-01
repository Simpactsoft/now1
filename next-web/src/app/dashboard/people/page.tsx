import { cookies } from "next/headers";
import PeopleViewWrapper from "@/components/PeopleViewWrapper";
import TenantSwitcher from "@/components/TenantSwitcher";
import PersonFormDialog from "@/components/PersonFormDialog";
import { Suspense } from "react";
import DashboardWrapper from "@/components/DashboardWrapper"; // Reusing or replacing wrapper logic
import DatabaseStats from "@/components/DatabaseStats";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "CRM Contacts | NOW System",
    description: "Manage all people and prospects",
};

export default async function PeoplePage() {
    const cookieStore = await cookies();
    const tenantId = cookieStore.get("tenant_id")?.value;

    return (
        <div className="flex flex-col gap-8">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
                <div className="flex flex-col gap-1">
                    <h1 className="text-4xl font-extrabold tracking-tight gradient-text">
                        CRM Contacts
                    </h1>
                    <p className="text-zinc-500 text-sm flex gap-1">
                        Total Database: <DatabaseStats tenantId={tenantId || ""} />
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    <PersonFormDialog tenantId={tenantId ?? ""} />
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
