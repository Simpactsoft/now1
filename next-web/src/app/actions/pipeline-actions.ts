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
    return { success: true, data };
}
