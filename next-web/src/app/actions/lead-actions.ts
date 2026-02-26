"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";
import { uuidSchema } from "./_shared/schemas";

interface ContactMethod {
    type: string;
    value: string;
    is_primary?: boolean;
}

function mapCardToLeadView(card: any) {
    const contactMethods: ContactMethod[] = Array.isArray(card.contact_methods) ? card.contact_methods : [];
    const primaryEmail = contactMethods.find((m) => m.type === 'email' && m.is_primary)?.value || contactMethods.find((m) => m.type === 'email')?.value;
    const primaryPhone = contactMethods.find((m) => m.type === 'phone' && m.is_primary)?.value || contactMethods.find((m) => m.type === 'phone')?.value;

    return {
        id: card.id,
        tenant_id: card.tenant_id,
        raw_name: card.display_name || 'Anonymous Lead',
        raw_company: card.company_name || null,
        raw_email: card.email || primaryEmail || null,
        raw_phone: card.phone || primaryPhone || null,
        status: card.lead_status || 'new',
        source: card.lead_source || 'Unknown',
        created_at: card.created_at,
    };
}

export async function fetchLeads(tenantId: string) {
    const parsed = uuidSchema.safeParse(tenantId);
    if (!parsed.success) return { success: false, error: "Invalid tenant ID" };

    const auth = await verifyAuthWithTenant(parsed.data);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
        .from('cards')
        .select('*')
        .eq('tenant_id', parsed.data)
        .eq('lifecycle_stage', 'lead')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching leads from cards:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return { success: false, error: JSON.stringify(error, Object.getOwnPropertyNames(error)) };
    }

    const mappedData = data?.map(mapCardToLeadView) || [];

    return { success: true, data: mappedData };
}

export async function updateLeadStatus(tenantId: string, leadId: string, status: string) {
    const parsed = uuidSchema.safeParse(tenantId);
    if (!parsed.success) return { success: false, error: "Invalid tenant ID" };

    const auth = await verifyAuthWithTenant(parsed.data);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
        .from('cards')
        .update({ lead_status: status, updated_at: new Date().toISOString() })
        .eq('tenant_id', parsed.data)
        .eq('id', leadId)
        .select()
        .single();

    if (error) {
        console.error("Error updating lead status in cards:", error);
        return { success: false, error: error.message };
    }

    const mappedUpdatedLead = mapCardToLeadView(data);

    return { success: true, data: mappedUpdatedLead };
}
