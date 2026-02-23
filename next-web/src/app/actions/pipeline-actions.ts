"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";
import { uuidSchema } from "./_shared/schemas";

export async function fetchPipelines(tenantId: string) {
    const parsed = uuidSchema.safeParse(tenantId);
    if (!parsed.success) return { success: false, error: "Invalid tenant ID" };

    const auth = await verifyAuthWithTenant(parsed.data);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
        .from('pipelines')
        .select('*')
        .eq('tenant_id', parsed.data)
        .order('name');

    if (error) {
        console.error("Error fetching pipelines:", error);
        return { success: false, error: error.message };
    }
    return { success: true, data };
}

export async function fetchPipelineStages(tenantId: string, pipelineId: string) {
    const parsed = uuidSchema.safeParse(tenantId);
    if (!parsed.success) return { success: false, error: "Invalid tenant ID" };

    const auth = await verifyAuthWithTenant(parsed.data);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
        .from('pipeline_stages')
        .select('*')
        .eq('tenant_id', parsed.data)
        .eq('pipeline_id', pipelineId)
        .order('display_order');

    if (error) {
        console.error("Error fetching pipeline stages:", error);
        return { success: false, error: error.message };
    }
    return { success: true, data };
}

export async function fetchOpportunities(tenantId: string, pipelineId: string) {
    const parsed = uuidSchema.safeParse(tenantId);
    if (!parsed.success) return { success: false, error: "Invalid tenant ID" };

    const auth = await verifyAuthWithTenant(parsed.data);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
        .from('opportunities')
        .select(`
            *,
            card:cards (
                id,
                display_name,
                type,
                card_type,
                company_name,
                first_name,
                last_name
            )
        `)
        .eq('tenant_id', parsed.data)
        .eq('pipeline_id', pipelineId);

    if (error) {
        console.error("Error fetching opportunities:", error);
        return { success: false, error: error.message };
    }
    return { success: true, data };
}

export async function updateOpportunityStage(tenantId: string, opportunityId: string, newStageId: string) {
    const parsed = uuidSchema.safeParse(tenantId);
    if (!parsed.success) return { success: false, error: "Invalid tenant ID" };

    const auth = await verifyAuthWithTenant(parsed.data);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
        .from('opportunities')
        .update({ stage_id: newStageId, updated_at: new Date().toISOString() })
        .eq('tenant_id', parsed.data)
        .eq('id', opportunityId)
        .select()
        .single();

    if (error) {
        console.error("Error updating opportunity stage:", error);
        return { success: false, error: error.message };
    }

    try {
        // --- COMMISSION CALCULATION HOOK ---
        // Check if the new stage is "Closed Won" (probability = 100)
        const { data: stage } = await adminClient
            .from('pipeline_stages')
            .select('probability')
            .eq('id', newStageId)
            .single();

        if (stage && stage.probability === 100) {
            // Find the active commission plan for this user's team or a global plan
            // For MVP: We find ANY active plan targeted at the user's team, or target_team_id IS NULL

            // 1. Get user's primary team
            const { data: teamMember } = await adminClient
                .from('team_members')
                .select('team_id')
                .eq('user_id', auth.userId)
                .eq('tenant_id', parsed.data)
                .is('removed_at', null)
                .order('is_primary_team', { ascending: false })
                .limit(1)
                .single();

            const userTeamId = teamMember?.team_id;

            // 2. Find eligible active plan
            let planQuery = adminClient
                .from('commission_plans')
                .select('*')
                .eq('tenant_id', parsed.data)
                .eq('is_active', true)
                .lte('effective_from', new Date().toISOString().split('T')[0])
                .order('created_at', { ascending: false });

            const { data: plans } = await planQuery;

            let bestPlan = null;
            if (plans && plans.length > 0) {
                // Prefer team-specific plan, fallback to global plan
                bestPlan = plans.find(p => p.target_team_id === userTeamId)
                    || plans.find(p => p.target_team_id === null);
            }

            if (bestPlan && data.amount > 0) {
                const commissionAmount = data.amount * bestPlan.base_rate;

                // 3. Insert into ledger
                await adminClient
                    .from('commission_ledger')
                    .insert({
                        tenant_id: parsed.data,
                        user_id: auth.userId, // The rep who won it
                        plan_id: bestPlan.id,
                        entity_type: 'opportunity',
                        entity_id: opportunityId,
                        period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // First day of current month
                        period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0], // Last day of current month
                        deal_value: data.amount,
                        commission_rate: bestPlan.base_rate,
                        commission_amount: commissionAmount,
                        status: 'pending' // Requires manager approval
                    });
            }
        }
    } catch (hookError) {
        console.error("Non-fatal error in commission hook:", hookError);
        // Do not fail the overall action if the hook fails
    }

    return { success: true, data };
}
