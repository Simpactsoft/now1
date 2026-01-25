"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export type AttributeDefinition = {
    id?: string;
    entity_type: 'person' | 'organization' | 'party';
    attribute_key: string;
    attribute_type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multi_select' | 'json';
    label_i18n: Record<string, string>;
    options_config?: { value: string; label: Record<string, string> }[];
    is_required?: boolean;
    is_system?: boolean;
    is_indexed?: boolean;
    ui_order?: number;
    description?: string;
};

export async function getTenantAttributes(entityType?: 'person' | 'organization' | 'party') {
    const supabase = await createClient();

    // Get Tenant
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    let tenantId = user.app_metadata?.tenant_id;

    if (!tenantId) {
        const cookieStore = await cookies();
        const rawCookie = cookieStore.get('tenant_id')?.value;
        if (rawCookie) {
            tenantId = rawCookie.replace(/['"]+/g, '').trim();
        }
    }

    if (!tenantId) return { error: "No Tenant ID" };

    let query = supabase
        .from('attribute_definitions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('ui_order', { ascending: true });

    if (entityType) {
        query = query.eq('entity_type', entityType);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching attributes:", error);
        return { error: error.message };
    }

    return { data };
}

export async function upsertAttribute(attribute: AttributeDefinition) {
    const cookieStore = await cookies();
    const cookieNames = cookieStore.getAll().map((c: { name: string }) => c.name).join(', ');
    console.log("upsertAttribute: Cookies present:", cookieNames);

    const supabase = await createClient(); // Instantiate supabase BEFORE using it
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
        console.error("upsertAttribute: Auth Failed.", authError);
        // Return debug info in the error message so the user can show us
        return {
            error: `Auth Error: ${authError?.message || "No Session"}. Cookies: [${cookieNames}]`
        };
    }

    // Authorization Check (Admin only ideally, but enforcing standard RLS for now)
    // In a real app check role: if (user.app_metadata.role !== 'admin') return { error: "Forbidden" };

    let tenantId = user.app_metadata?.tenant_id;

    if (!tenantId) {
        // Fallback: Try to get tenant ID from cookie (active session context)
        const rawCookie = cookieStore.get('tenant_id')?.value;
        if (rawCookie) {
            tenantId = rawCookie.replace(/['"]+/g, '').trim();
            console.log("upsertAttribute: Used tenant_id from cookie:", tenantId);
        }
    }

    if (!tenantId) {
        console.error("upsertAttribute: No tenant_id found in app_metadata OR cookies.");
        return { error: "Unauthorized: No Tenant ID linked to user or session." };
    }

    const payload = {
        ...attribute,
        tenant_id: tenantId,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('attribute_definitions')
        .upsert(payload)
        .select()
        .single();

    if (error) {
        console.error("upsertAttribute DB Error:", error);
        return { error: `Database Error: ${error.message} (${error.code})` };
    }

    revalidatePath('/dashboard/settings');
    return { data };
}

// --- Option Sets Engine ---

export type OptionSet = {
    id: string;
    code: string;
    description?: string;
    is_locked?: boolean;
    tenant_id?: string | null;
};

export type OptionValue = {
    id: string;
    internal_code: string;
    label_i18n: Record<string, string>;
    color?: string;
    icon?: string;
    is_system?: boolean;
    is_custom?: boolean;
};

export async function fetchOptionSets() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    let tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) {
        const cookieStore = await cookies();
        const rawCookie = cookieStore.get('tenant_id')?.value;
        if (rawCookie) tenantId = rawCookie.replace(/['"]+/g, '').trim();
    }

    // Fetch sets: Global (null tenant) OR Specific Tenant
    // Note: RLS should handle this, but explicit filtering helps clarity
    const { data, error } = await supabase
        .from('option_sets')
        .select('*')
        .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
        .order('code');

    if (error) return { error: error.message };
    return { data };
}

export async function fetchOptionSetValues(setCode: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let tenantId = user?.app_metadata?.tenant_id;
    if (!tenantId) {
        const cookieStore = await cookies();
        const rawCookie = cookieStore.get('tenant_id')?.value;
        if (rawCookie) tenantId = rawCookie.replace(/['"]+/g, '').trim();
    }

    console.log(`[fetchOptionSetValues] Called for setCode: ${setCode}, Tenant: ${tenantId}`);

    if (!tenantId) {
        console.warn("[fetchOptionSetValues] No Tenant Context found.");
        return { error: "No Tenant Context" };
    }

    const { data, error } = await supabase.rpc('get_option_set_values', {
        p_set_code: setCode,
        p_tenant_id: tenantId,
        p_lang_code: 'en'
    });

    if (error) {
        console.error("[fetchOptionSetValues] RPC Error:", error);
        return { error: error.message };
    }

    console.log(`[fetchOptionSetValues] Result count for ${setCode}:`, data?.length || 0);
    // console.log(`[DEBUG] Data:`, data); // Uncomment for deep debug
    return { data };
}

export async function createOptionSet(params: {
    code: string;
    description: string;
    values: { label: string; value: string }[];
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    let tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) {
        const cookieStore = await cookies();
        const rawCookie = cookieStore.get('tenant_id')?.value;
        if (rawCookie) tenantId = rawCookie.replace(/['"]+/g, '').trim();
    }
    if (!tenantId) return { error: "No Tenant Context" };

    // 1. Create the Set
    const { data: set, error: setError } = await supabase
        .from('option_sets')
        .insert({
            tenant_id: tenantId,
            code: params.code,
            description: params.description
        })
        .select()
        .single();

    if (setError) {
        console.error("Error creating option set:", setError);
        return { error: setError.message };
    }

    // 2. Create the Values
    if (params.values.length > 0) {
        const valuesPayload = params.values.map((v, idx) => ({
            option_set_id: set.id,
            tenant_id: tenantId,
            internal_code: v.value,
            label_i18n: { en: v.label }, // Default to English for now
            sort_order: idx * 10
        }));

        const { error: valError } = await supabase
            .from('option_values')
            .insert(valuesPayload);

        if (valError) {
            console.error("Error creating option values:", valError);
            // Optional: Rollback set? For now, we return error but set exists empty.
            return { error: valError.message };
        }
    }

    revalidatePath('/dashboard/settings');
    return { success: true, data: set };
}

export async function deleteAttribute(id: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('attribute_definitions')
        .delete()
        .eq('id', id);

    if (error) return { error: error.message };

    revalidatePath('/dashboard/settings');
    return { success: true };
}
