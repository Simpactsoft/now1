"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ActionResult, actionSuccess, actionOk, actionError } from "@/lib/action-result";

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


const SYSTEM_ATTRIBUTES: AttributeDefinition[] = [
    {
        id: 'sys_status',
        entity_type: 'party',
        attribute_key: 'status',
        attribute_type: 'select',
        label_i18n: { en: 'Status', he: 'סטטוס' },
        is_required: true,
        is_system: true,
        ui_order: 0,
        options_config: [{ value: 'CONTACT_STATUS', label: { en: 'Contact Status', he: 'סטטוס קשר' } }]
    },
    {
        id: 'sys_tags',
        entity_type: 'party',
        attribute_key: 'tags',
        attribute_type: 'multi_select',
        label_i18n: { en: 'Tags', he: 'תגיות' },
        is_system: true,
        ui_order: 1
    },
    {
        id: 'sys_first_name',
        entity_type: 'person',
        attribute_key: 'first_name',
        attribute_type: 'text',
        label_i18n: { en: 'First Name', he: 'שם פרטי' },
        is_required: true,
        is_system: true,
        ui_order: 2
    },
    {
        id: 'sys_last_name',
        entity_type: 'person',
        attribute_key: 'last_name',
        attribute_type: 'text',
        label_i18n: { en: 'Last Name', he: 'שם משפחה' },
        is_required: true,
        is_system: true,
        ui_order: 3
    },
    {
        id: 'sys_email',
        entity_type: 'person', // Technically contact method, but often treated as main field
        attribute_key: 'email',
        attribute_type: 'text',
        label_i18n: { en: 'Email', he: 'אימייל' },
        is_system: true,
        ui_order: 4
    }
];

export async function getTenantAttributes(entityType?: 'person' | 'organization' | 'party'): Promise<ActionResult<AttributeDefinition[]>> {
    const supabase = await createClient();

    // Get Tenant
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return actionError("Unauthorized", "AUTH_ERROR");

    let tenantId = user.app_metadata?.tenant_id;

    if (!tenantId) {
        const cookieStore = await cookies();
        const rawCookie = cookieStore.get('tenant_id')?.value;
        if (rawCookie) {
            tenantId = rawCookie.replace(/['"]+/g, '').trim();
        }
    }

    if (!tenantId) return actionError("No Tenant ID", "AUTH_ERROR");

    let query = supabase
        .from('attribute_definitions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('ui_order', { ascending: true });

    if (entityType) {
        // If requesting 'person', we want 'person' AND 'party' attributes
        if (entityType === 'person') {
            query = query.in('entity_type', ['person', 'party']);
        } else if (entityType === 'organization') {
            query = query.in('entity_type', ['organization', 'party']);
        } else {
            query = query.eq('entity_type', entityType);
        }
    }

    const { data: dbAttributes, error } = await query;

    if (error) {
        console.error("Error fetching attributes:", error);
        return actionError(error.message, "DB_ERROR");
    }

    // Filter System Attributes based on specific request
    let systemAttrs = SYSTEM_ATTRIBUTES;
    if (entityType) {
        if (entityType === 'person') {
            systemAttrs = SYSTEM_ATTRIBUTES.filter(a => a.entity_type === 'person' || a.entity_type === 'party');
        } else if (entityType === 'organization') {
            systemAttrs = SYSTEM_ATTRIBUTES.filter(a => a.entity_type === 'organization' || a.entity_type === 'party');
        } else {
            systemAttrs = SYSTEM_ATTRIBUTES.filter(a => a.entity_type === entityType);
        }
    }

    // Merge: System First, then Custom
    // Note: In real app, might want to respect ui_order across both.
    // Logic: DB Attributes OVERRIDE System Attributes if keys match.
    // This allows a tenant to "Save" a system attribute with new Label/Required settings.

    const dbKeys = new Set((dbAttributes || []).map(a => a.attribute_key));
    const effectiveSystemAttrs = systemAttrs.filter(sa => !dbKeys.has(sa.attribute_key));

    const merged = [...effectiveSystemAttrs, ...(dbAttributes || [])].sort((a, b) => (a.ui_order || 99) - (b.ui_order || 99));

    return actionSuccess(merged);
}

export async function addTenantOptionValue(setCode: string, value: string, label: string): Promise<ActionResult<void>> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return actionError("Unauthorized", "AUTH_ERROR");

    let tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) {
        const cookieStore = await cookies();
        const rawCookie = cookieStore.get('tenant_id')?.value;
        if (rawCookie) tenantId = rawCookie.replace(/['"]+/g, '').trim();
    }
    if (!tenantId) return actionError("No Tenant Context", "AUTH_ERROR");

    // 1. Find the Option Set ID (Global or Tenant)
    // We prefer the Tenant local set if it exists, otherwise the Global set.
    // Actually, usually it's the same Set ID shared, or we just need ANY id that matches the code.
    const { data: sets, error: fetchError } = await supabase
        .from('option_sets')
        .select('id, tenant_id')
        .eq('code', setCode)
        .order('tenant_id', { ascending: false }); // helper to pick tenant specific if multiple?

    if (fetchError || !sets || sets.length === 0) {
        return actionError(`Option Set '${setCode}' not found.`, "NOT_FOUND");
    }

    const targetSetId = sets[0].id;

    // 2. Insert Option Value
    const { error } = await supabase
        .from('option_values')
        .insert({
            option_set_id: targetSetId,
            tenant_id: tenantId,
            internal_code: value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
            label_i18n: { en: label },
            is_custom: true
        });

    if (error) {
        console.error("Error adding option value:", error);
        return actionError(error.message, "DB_ERROR");
    }

    revalidatePath('/dashboard/settings');
    return actionOk();
}

export async function upsertAttribute(attribute: AttributeDefinition): Promise<ActionResult<AttributeDefinition>> {
    const cookieStore = await cookies();
    const cookieNames = cookieStore.getAll().map((c: { name: string }) => c.name).join(', ');
    console.log("upsertAttribute: Cookies present:", cookieNames);

    const supabase = await createClient(); // Instantiate supabase BEFORE using it
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
        console.error("upsertAttribute: Auth Failed.", authError);
        // Return debug info in the error message so the user can show us
        return actionError(`Auth Error: ${authError?.message || "No Session"}. Cookies: [${cookieNames}]`, "AUTH_ERROR");
    }

    // Authorization Check (Admin only ideally, but enforcing standard RLS for now)
    // In a real app check role: if (user.app_metadata.role !== 'admin') return actionError("Forbidden", "AUTH_ERROR");

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
        return actionError("Unauthorized: No Tenant ID linked to user or session.", "AUTH_ERROR");
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
        return actionError(`Database Error: ${error.message} (${error.code})`, "DB_ERROR");
    }

    revalidatePath('/dashboard/settings');
    return actionSuccess(data);
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

export async function fetchOptionSets(): Promise<ActionResult<OptionSet[]>> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return actionError("Unauthorized", "AUTH_ERROR");

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

    if (error) return actionError(error.message, "DB_ERROR");
    return actionSuccess(data as OptionSet[]);
}

export async function fetchOptionSetValues(setCode: string): Promise<ActionResult<OptionValue[]>> {
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
        return actionError("No Tenant Context", "AUTH_ERROR");
    }

    const { data, error } = await supabase.rpc('get_option_set_values', {
        p_set_code: setCode,
        p_tenant_id: tenantId,
        p_lang_code: 'en'
    });

    if (error) {
        console.error("[fetchOptionSetValues] RPC Error:", error);
        return actionError(error.message, "DB_ERROR");
    }

    console.log(`[fetchOptionSetValues] Result count for ${setCode}:`, data?.length || 0);
    // console.log(`[DEBUG] Data:`, data); // Uncomment for deep debug
    return actionSuccess(data as OptionValue[]);
}

export async function createOptionSet(params: {
    code: string;
    description: string;
    values: { label: string; value: string }[];
}): Promise<ActionResult<OptionSet>> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return actionError("Unauthorized", "AUTH_ERROR");

    let tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) {
        const cookieStore = await cookies();
        const rawCookie = cookieStore.get('tenant_id')?.value;
        if (rawCookie) tenantId = rawCookie.replace(/['"]+/g, '').trim();
    }
    if (!tenantId) return actionError("No Tenant Context", "AUTH_ERROR");

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
        return actionError(setError.message, "DB_ERROR");
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
            return actionError(valError.message, "DB_ERROR");
        }
    }

    revalidatePath('/dashboard/settings');
    return actionSuccess(set as OptionSet);
}

export async function deleteAttribute(id: string): Promise<ActionResult<void>> {
    const supabase = await createClient();

    const { error } = await supabase
        .from('attribute_definitions')
        .delete()
        .eq('id', id);

    if (error) return actionError(error.message, "DB_ERROR");

    revalidatePath('/dashboard/settings');
    return actionOk();
}
