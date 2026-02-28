"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";
import { revalidatePath } from "next/cache";

/**
 * Deletes a team member from both Auth and Profiles (via cascade).
 */
export async function deleteTeamMember(userId: string): Promise<ActionResult<void>> {
    const adminClient = createAdminClient();

    try {
        // Delete from Auth (this triggers cascade delete on profiles in our schema)
        const { error } = await adminClient.auth.admin.deleteUser(userId);

        if (error) {
            console.error("[deleteTeamMember] Auth error:", error);
            return actionError(error.message, "AUTH_ERROR");
        }

        revalidatePath("/dashboard/settings/team");
        return actionSuccess(undefined);
    } catch (err: any) {
        console.error("[deleteTeamMember] Unexpected error:", err);
        return actionError("Failed to delete user");
    }
}

/**
 * Updates a user's status (active, suspended, inactive).
 */
export async function updateUserStatus(
    userId: string,
    status: 'active' | 'suspended' | 'inactive'
): Promise<ActionResult<void>> {
    const adminClient = createAdminClient();

    try {
        const { error: updateError } = await adminClient
            .from("profiles")
            .update({
                status,
                updated_at: new Date().toISOString()
            })
            .eq("id", userId);

        if (updateError) {
            console.error("[updateUserStatus] DB error:", updateError);
            return actionError(updateError.message, "DB_ERROR");
        }

        revalidatePath("/dashboard/settings/team");
        return actionSuccess(undefined);
    } catch (err: any) {
        console.error("[updateUserStatus] Unexpected error:", err);
        return actionError("Failed to update status");
    }
}

// --- Team Management Actions ---

/**
 * Fetches all teams for a given tenant.
 */
export async function fetchTeams(tenantId: string): Promise<ActionResult<any[]>> {
    const adminClient = createAdminClient();
    try {
        const { data, error } = await adminClient
            .from("teams")
            .select(`
                *,
                parent:teams!parent_team_id (name)
            `)
            .eq("tenant_id", tenantId)
            .is("deleted_at", null)
            .order("name");

        if (error) {
            console.error("[fetchTeams] error:", error);
            return actionError(error.message);
        }
        return actionSuccess(data);
    } catch (err: any) {
        console.error("[fetchTeams] error:", err);
        return actionError("Failed to fetch teams");
    }
}

/**
 * Fetches all roles available for a tenant.
 */
export async function fetchRoles(tenantId: string): Promise<ActionResult<any[]>> {
    const adminClient = createAdminClient();
    try {
        const { data, error } = await adminClient
            .from("roles")
            .select("*")
            .eq("tenant_id", tenantId)
            .is("deleted_at", null)
            .order("hierarchy_level", { ascending: true });

        if (error) {
            console.error("[fetchRoles] error:", error);
            return actionError(error.message);
        }
        return actionSuccess(data);
    } catch (err: any) {
        console.error("[fetchRoles] error:", err);
        return actionError("Failed to fetch roles");
    }
}

/**
 * Fetches all members of a specific team with their profiles.
 */
export async function fetchTeamMembers(tenantId: string, teamId: string): Promise<ActionResult<any[]>> {
    const adminClient = createAdminClient();
    try {
        const { data, error } = await adminClient
            .from("team_members")
            .select(`
                *,
                user_profile:user_profiles (
                    *,
                    role:roles (*)
                )
            `)
            .eq("tenant_id", tenantId)
            .eq("team_id", teamId)
            .is("removed_at", null);

        if (error) {
            console.error("[fetchTeamMembers] error:", error);
            return actionError(error.message);
        }
        return actionSuccess(data);
    } catch (err: any) {
        console.error("[fetchTeamMembers] error:", err);
        return actionError("Failed to fetch team members");
    }
}

/**
 * Creates a new team entry in the teams table.
 */
export async function createTeam(data: {
    tenantId: string;
    name: string;
    parentTeamId?: string | null;
    region?: string | null;
    country?: string | null;
    timezone?: string | null;
}): Promise<ActionResult<any>> {
    const adminClient = createAdminClient();
    try {
        const { data: team, error } = await adminClient
            .from("teams")
            .insert({
                tenant_id: data.tenantId,
                name: data.name,
                parent_team_id: data.parentTeamId,
                region: data.region,
                country: data.country,
                timezone: data.timezone
            })
            .select()
            .single();

        if (error) {
            console.error("[createTeam] error:", error);
            return actionError(error.message);
        }
        revalidatePath("/dashboard/admin/teams");
        return actionSuccess(team);
    } catch (err: any) {
        console.error("[createTeam] error:", err);
        return actionError("Failed to create team");
    }
}

/**
 * Updates or inserts a team member, and optionally updates their system role.
 */
export async function updateTeamMember(
    tenantId: string,
    teamId: string,
    userId: string,
    roleInTeam: 'manager' | 'member',
    isPrimary: boolean,
    systemRoleId?: string
): Promise<ActionResult<void>> {
    const adminClient = createAdminClient();
    try {
        // 1. Update/Upsert team member
        const { error: memberError } = await adminClient
            .from("team_members")
            .upsert({
                tenant_id: tenantId,
                team_id: teamId,
                user_id: userId,
                role_in_team: roleInTeam,
                is_primary_team: isPrimary,
                removed_at: null
            }, {
                onConflict: "team_id,user_id"
            });

        if (memberError) {
            console.error("[updateTeamMember] member error:", memberError);
            return actionError(memberError.message);
        }

        // 2. Update system role if provided (updates user_profiles)
        if (systemRoleId) {
            const { error: roleError } = await adminClient
                .from("user_profiles")
                .update({ role_id: systemRoleId })
                .eq("user_id", userId)
                .eq("tenant_id", tenantId);

            if (roleError) {
                console.error("[updateTeamMember] profile role error:", roleError);
                return actionError(roleError.message);
            }
        }

        revalidatePath("/dashboard/admin/teams");
        return actionSuccess(undefined);
    } catch (err: any) {
        console.error("[updateTeamMember] error:", err);
        return actionError("Failed to update team member");
    }
}

/**
 * Marks a team member as removed from a specific team.
 */
export async function removeTeamMember(tenantId: string, teamId: string, userId: string): Promise<ActionResult<void>> {
    const adminClient = createAdminClient();
    try {
        const { error } = await adminClient
            .from("team_members")
            .update({ removed_at: new Date().toISOString() })
            .eq("tenant_id", tenantId)
            .eq("team_id", teamId)
            .eq("user_id", userId);

        if (error) {
            console.error("[removeTeamMember] error:", error);
            return actionError(error.message);
        }
        revalidatePath("/dashboard/admin/teams");
        return actionSuccess(undefined);
    } catch (err: any) {
        console.error("[removeTeamMember] error:", err);
        return actionError("Failed to remove team member");
    }
}

// Helper for 'now()' on node side if DB trigger isn't sufficient
function foreign_now() {
    return new Date().toISOString();
}
