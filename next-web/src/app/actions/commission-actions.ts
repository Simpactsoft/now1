"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";

export async function fetchCommissionPlans(tenantId: string) {
    if (!tenantId) return { error: "Missing tenant ID" };

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
        .from("commission_plans")
        .select(`
      *,
      target_team:target_team_id ( id, name )
    `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("fetchCommissionPlans error:", error);
        return { error: "Failed to fetch commission plans" };
    }

    return { success: true, data };
}

const CreatePlanSchema = z.object({
    tenantId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    baseRate: z.number().min(0).max(100),
    effectiveFrom: z.string().min(1),
    effectiveTo: z.string().optional().nullable(),
    targetTeamId: z.string().optional().nullable(),
});

export async function createCommissionPlan(data: z.infer<typeof CreatePlanSchema>) {
    const parsed = CreatePlanSchema.safeParse(data);
    if (!parsed.success) return { error: "Invalid input" };

    const { tenantId, name, description, baseRate, effectiveFrom, effectiveTo, targetTeamId } = parsed.data;

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { error: "Unauthorized" };

    const adminClient = createAdminClient();

    // Convert percentage (e.g., 5) to decimal (e.g., 0.05) for the DB
    const decimalRate = baseRate / 100;

    const { data: plan, error } = await adminClient
        .from("commission_plans")
        .insert({
            tenant_id: tenantId,
            name,
            description,
            base_rate: decimalRate,
            effective_from: effectiveFrom,
            effective_to: effectiveTo || null,
            target_team_id: targetTeamId || null,
            created_by: auth.userId
        })
        .select()
        .single();

    if (error) {
        console.error("createCommissionPlan error:", error);
        return { error: error.message };
    }

    return { success: true, data: plan };
}

export async function toggleCommissionPlan(tenantId: string, planId: string, isActive: boolean) {
    if (!tenantId || !planId) return { error: "Missing required parameters" };

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { error: "Unauthorized" };

    const adminClient = createAdminClient();
    const { error } = await adminClient
        .from("commission_plans")
        .update({ is_active: isActive, updated_by: auth.userId })
        .eq("tenant_id", tenantId)
        .eq("id", planId);

    if (error) {
        console.error("toggleCommissionPlan error:", error);
        return { error: error.message };
    }

    return { success: true };
}

// ---------------------------------------------------------------------------
// LEDGER ACTIONS
// ---------------------------------------------------------------------------

export async function fetchCommissionLedger(tenantId: string, viewMode: 'my' | 'team' = 'my') {
    if (!tenantId) return { error: "Missing tenant ID" };

    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { error: "Unauthorized" };

    const adminClient = createAdminClient();

    let query = adminClient
        .from("commission_ledger")
        .select(`
      *,
      plan:plan_id ( name, base_rate )
    `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

    if (viewMode === 'my') {
        // Only get current user's commissions
        query = query.eq('user_id', auth.userId);
    } else {
        // Future Enhancement for 'team':
        // Here we would ideally use the `is_manager_of` or `is_in_team_hierarchy` RPCs 
        // to filter ledgers down to just the people the user manages.
        // For MVP, if they select 'team', we will fetch all (assuming they are an admin).
    }

    const { data, error } = await query;

    if (error) {
        console.error("fetchCommissionLedger error:", error);
        return { error: "Failed to fetch ledger" };
    }

    if (data && data.length > 0) {
        const oppIds = data.filter((row: any) => row.entity_type === 'opportunity' && row.entity_id).map((row: any) => row.entity_id);
        if (oppIds.length > 0) {
            const { data: opps } = await adminClient
                .from('opportunities')
                .select('id, name')
                .in('id', oppIds);

            if (opps) {
                const oppMap = new Map(opps.map(o => [o.id, o]));
                data.forEach((row: any) => {
                    if (row.entity_type === 'opportunity' && row.entity_id && oppMap.has(row.entity_id)) {
                        row.opportunity = oppMap.get(row.entity_id);
                    }
                });
            }
        }
    }

    return { success: true, data };
}

// Future: approvePayout, markAsPaid, etc.
