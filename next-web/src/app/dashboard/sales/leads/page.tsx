import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/actions/getCurrentUser";
import { fetchLeads } from "@/app/actions/lead-actions";
import { LeadsInboxClient } from "./LeadsInboxClient";

import { cookies } from "next/headers";

export const metadata = {
    title: 'Leads Inbox | CRM',
};

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
    const userRes = await getCurrentUser();
    if (!userRes || !userRes.success || !userRes.data) redirect("/login");

    const cookieStore = await cookies();
    const tenantId = cookieStore.get('tenant_id')?.value;

    if (!tenantId) {
        return (
            <div className="flex h-full items-center justify-center p-8 bg-background">
                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold">No Active Organization</h2>
                    <p className="text-muted-foreground">Please select an organization to view leads.</p>
                </div>
            </div>
        );
    }

    const leadsRes = await fetchLeads(tenantId);

    if (!leadsRes.success) {
        return (
            <div className="flex h-full items-center justify-center p-8 bg-background">
                <div className="text-center space-y-4 text-red-500">
                    <h2 className="text-2xl font-bold">Error Loading Leads</h2>
                    <p>{leadsRes.error}</p>
                </div>
            </div>
        );
    }

    const leads = leadsRes.data || [];

    return (
        <div className="h-full flex flex-col p-6 space-y-6 min-h-0">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Leads Inbox</h1>
                    <p className="text-muted-foreground">Process, qualify, and convert new incoming leads.</p>
                </div>
            </div>

            <LeadsInboxClient tenantId={tenantId} initialLeads={leads} />
        </div>
    );
}
