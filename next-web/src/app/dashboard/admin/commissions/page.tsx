import { cookies } from "next/headers";
import { Suspense } from "react";
import { fetchCommissionPlans } from "@/app/actions/commission-actions";
import { fetchTeams } from "@/app/actions/team-actions";
import CommissionAdminClient from "./CommissionAdminClient";

export const dynamic = "force-dynamic";

export default async function CommissionAdminPage() {
    const cookieStore = await cookies();
    const rawTenantId = cookieStore.get("tenant_id")?.value;
    const tenantId = rawTenantId?.replace(/['"]+/g, '');

    if (!tenantId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] border border-dashed border-white/10 rounded-3xl bg-white/5">
                <p className="text-zinc-400 font-medium">Please select a tenant to view commission plans</p>
            </div>
        );
    }

    const [plansRes, teamsRes] = await Promise.all([
        fetchCommissionPlans(tenantId),
        fetchTeams(tenantId)
    ]);

    const plans = plansRes.success && plansRes.data ? plansRes.data : [];
    const teams = teamsRes.success && teamsRes.data ? teamsRes.data : [];

    return (
        <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                        Commission Plans
                    </h1>
                    <p className="text-sm text-muted-foreground w-3/4">
                        Define compensation structures, set base rates, and assign target teams to automatically calculate commissions on won deals.
                    </p>
                </div>
            </div>

            <Suspense fallback={<div>Loading plans...</div>}>
                <CommissionAdminClient initialPlans={plans} tenantId={tenantId} teams={teams} />
            </Suspense>
        </div>
    );
}
