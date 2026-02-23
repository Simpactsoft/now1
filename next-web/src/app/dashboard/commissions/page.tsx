import { cookies } from "next/headers";
import { Suspense } from "react";
import { fetchCommissionLedger } from "@/app/actions/commission-actions";
import { getCurrentUser } from "@/app/actions/getCurrentUser";
import CommissionsDashboardClient from "./CommissionsDashboardClient";

export const dynamic = "force-dynamic";

export default async function CommissionsDashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
    const cookieStore = await cookies();
    const rawTenantId = cookieStore.get("tenant_id")?.value;
    const tenantId = rawTenantId?.replace(/['"]+/g, '');

    const params = await searchParams;
    const viewMode = params.view === 'team' ? 'team' : 'my';

    if (!tenantId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] border border-dashed border-white/10 rounded-3xl bg-white/5">
                <p className="text-zinc-400 font-medium">Please select a tenant to view commissions.</p>
            </div>
        );
    }

    const [userRes, ledgerRes] = await Promise.all([
        getCurrentUser(),
        fetchCommissionLedger(tenantId, viewMode as 'my' | 'team')
    ]);

    const user = userRes.success ? userRes.data : null;
    const ledger = ledgerRes.success && ledgerRes.data ? ledgerRes.data : [];

    return (
        <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                        Commission Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Track your earnings, active plans, and pending payouts.
                    </p>
                </div>
            </div>

            <Suspense fallback={<div>Loading ledger...</div>}>
                <CommissionsDashboardClient initialLedger={ledger} tenantId={tenantId} user={user} currentView={viewMode} />
            </Suspense>
        </div>
    );
}
