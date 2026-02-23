import { cookies } from "next/headers";
import { Suspense } from "react";
import { fetchTeams, fetchRoles } from "@/app/actions/team-actions";
import { fetchTenantDetails } from "@/app/actions/fetchTenantDetails";
import TeamManagerClient from "./TeamManagerClient";

export const dynamic = "force-dynamic";

export default async function TeamsAdminPage() {
    const cookieStore = await cookies();
    const rawTenantId = cookieStore.get("tenant_id")?.value;
    const tenantId = rawTenantId?.replace(/['"]+/g, '');

    if (!tenantId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] border border-dashed border-white/10 rounded-3xl bg-white/5">
                <p className="text-zinc-400 font-medium">Please select a tenant to view teams</p>
            </div>
        );
    }

    const [teamsRes, detailsRes, rolesRes] = await Promise.all([
        fetchTeams(tenantId),
        fetchTenantDetails(tenantId),
        fetchRoles(tenantId)
    ]);

    const teams = teamsRes.success && teamsRes.data ? teamsRes.data : [];
    const users = detailsRes.success && detailsRes.data?.users ? detailsRes.data.users : [];
    const roles = rolesRes.success && rolesRes.data ? rolesRes.data : [];

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Team Organization
                </h1>
                <p className="text-sm text-muted-foreground w-1/2 text-right">
                    Manage teams, managers, and member assignments to control data access and reporting hierarchy.
                </p>
            </div>

            <Suspense fallback={<div>Loading teams...</div>}>
                <TeamManagerClient initialTeams={teams} tenantId={tenantId} allUsers={users} initialRoles={roles} />
            </Suspense>
        </div>
    );
}
