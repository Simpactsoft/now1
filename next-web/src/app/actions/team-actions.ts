"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";

export async function fetchTeams(tenantId: string) {
    if (!tenantId) return { error: "Missing tenant ID" };

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
        .from("teams")
        .select(`
      *,
      manager:manager_user_id ( id, email, raw_user_meta_data ),
      parent:parent_team_id ( id, name )
    `)
        .eq("tenant_id", tenantId)
        .order("name");

    if (error) {
        console.error("fetchTeams error:", error);
        return { error: "Failed to fetch teams" };
    }

    return { success: true, data };
}

export async function fetchRoles(tenantId: string) {
    if (!tenantId) return { error: "Missing tenant ID" };

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
        .from("roles")
        .select("*")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("hierarchy_level", { ascending: true })
        .order("name", { ascending: true });

    if (error) {
        console.error("fetchRoles error:", error);
        return { error: "Failed to fetch roles" };
    }

    return { success: true, data };
}

export async function fetchTeamMembers(tenantId: string, teamId: string) {
    if (!tenantId || !teamId) return { error: "Missing required parameters" };

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { error: "Unauthorized" };

    const adminClient = createAdminClient();
    // Using auth.users via a join or fetching directly the emails isn't directly supported using foreign keys without a view in Supabase auth schema.
    // We will fetch team_members and then fetch user details separately or expect user details to be in user_profiles.
    // Since user_profiles exists in the schema, we'll join that.

    const { data, error } = await adminClient
        .from("team_members")
        .select(`
      *,
      user_profile:user_profiles!user_id ( id, display_name, email, avatar_url, role:roles ( id, name ) )
    `)
        .eq("tenant_id", tenantId)
        .eq("team_id", teamId)
        .is("removed_at", null)
        .order("joined_at", { ascending: false });

    if (error) {
        console.error("fetchTeamMembers error:", error);
        return { error: "Failed to fetch team members" };
    }

    return { success: true, data };
}

const CreateTeamSchema = z.object({
    tenantId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    parentTeamId: z.string().optional().nullable(),
    managerUserId: z.string().optional().nullable(),
    region: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    timezone: z.string().optional().nullable(),
});

export async function createTeam(data: z.infer<typeof CreateTeamSchema>) {
    const parsed = CreateTeamSchema.safeParse(data);
    if (!parsed.success) return { error: "Invalid input" };

    const { tenantId, name, description, parentTeamId, managerUserId, region, country, timezone } = parsed.data;

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { data: team, error } = await adminClient
        .from("teams")
        .insert({
            tenant_id: tenantId,
            name,
            description,
            parent_team_id: parentTeamId || null,
            manager_user_id: managerUserId || null,
            region: region || null,
            country: country || null,
            timezone: timezone || null,
            created_by: auth.userId
        })
        .select()
        .single();

    if (error) {
        console.error("createTeam error:", error);
        return { error: error.message };
    }

    return { success: true, data: team };
}

export async function updateTeamMember(tenantId: string, teamId: string, userId: string, role: 'manager' | 'member', isPrimary: boolean, systemRoleId?: string) {
    if (!tenantId || !teamId || !userId) return { error: "Missing required parameters" };

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { error: "Unauthorized" };

    const adminClient = createAdminClient();

    // If a system role was provided, update the user profile
    if (systemRoleId) {
        const { error: profileError } = await adminClient
            .from("user_profiles")
            .update({ role_id: systemRoleId })
            .eq("tenant_id", tenantId)
            .eq("user_id", userId);

        if (profileError) {
            console.error("Failed to update user system role:", profileError);
            // We'll proceed to update team membership anyway, but this might be an issue
        }
    }

    // First check if they exist
    const { data: existing } = await adminClient
        .from("team_members")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .is("removed_at", null)
        .single();

    if (existing) {
        // Update
        const { error } = await adminClient
            .from("team_members")
            .update({ role_in_team: role, is_primary_team: isPrimary })
            .eq("id", existing.id);
        if (error) return { error: error.message };
    } else {
        // Insert
        const { error } = await adminClient
            .from("team_members")
            .insert({
                tenant_id: tenantId,
                team_id: teamId,
                user_id: userId,
                role_in_team: role,
                is_primary_team: isPrimary
            });
        if (error) return { error: error.message };
    }

    return { success: true };
}

export async function removeTeamMember(tenantId: string, teamId: string, userId: string) {
    if (!tenantId || !teamId || !userId) return { error: "Missing required parameters" };

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { error } = await adminClient
        .from("team_members")
        .update({ removed_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .is("removed_at", null);

    if (error) {
        console.error("removeTeamMember error:", error);
        return { error: error.message };
    }

    return { success: true };
}
