"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";
import { uuidSchema } from "./_shared/schemas";

export async function fetchLeads(tenantId: string) {
    const parsed = uuidSchema.safeParse(tenantId);
    if (!parsed.success) return { success: false, error: "Invalid tenant ID" };

    const auth = await verifyAuthWithTenant(parsed.data);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
        .from('leads')
        .select('*')
        .eq('tenant_id', parsed.data)
        .order('created_at', { ascending: false });

    console.log("fetchLeads: querying for tenant:", parsed.data);
    console.log("fetchLeads: data length=", data?.length, "error=", error);

    if (error) {
        console.error("Error fetching leads:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return { success: false, error: JSON.stringify(error, Object.getOwnPropertyNames(error)) };
    }
    return { success: true, data };
}

export async function updateLeadStatus(tenantId: string, leadId: string, status: string) {
    const parsed = uuidSchema.safeParse(tenantId);
    if (!parsed.success) return { success: false, error: "Invalid tenant ID" };

    const auth = await verifyAuthWithTenant(parsed.data);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
        .from('leads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('tenant_id', parsed.data)
        .eq('id', leadId)
        .select()
        .single();

    if (error) {
        console.error("Error updating lead status:", error);
        return { success: false, error: error.message };
    }
    return { success: true, data };
}
