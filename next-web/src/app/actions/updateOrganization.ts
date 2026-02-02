"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UpdateOrgSchema = z.object({
    id: z.string().regex(uuidRegex, "Invalid ID format"),
    tenantId: z.string().regex(uuidRegex, "Invalid Tenant ID format"),
    displayName: z.string().optional(),
    email: z.string().optional().or(z.literal("")),
    phone: z.string().optional(),
    website: z.string().optional(),
    customFields: z.record(z.any()).optional(),
    tags: z.array(z.string()).optional()
});

export type UpdateOrgInput = z.infer<typeof UpdateOrgSchema>;

export async function updateOrganization(rawInput: any) {
    const supabase = await createClient();

    // 0. Sanitize Input
    const sanitize = (val: any) => typeof val === 'string' ? val.trim() : val;
    const cleanId = (val: any) => typeof val === 'string' ? val.replace(/['"]+/g, '').trim() : val;

    const params = {
        ...rawInput,
        id: cleanId(rawInput.id),
        tenantId: cleanId(rawInput.tenantId),
        displayName: sanitize(rawInput.displayName),
        email: sanitize(rawInput.email),
        phone: sanitize(rawInput.phone),
        website: sanitize(rawInput.website),
    };

    // 1. Validate Input
    let result;
    try {
        result = UpdateOrgSchema.safeParse(params);
    } catch (zodError: any) {
        console.error("ZOD Error:", zodError);
        return { success: false, error: "Validation Error" };
    }

    if (!result.success) {
        console.error("Validation Failed:", result.error);
        return { success: false, error: "Validation failed" };
    }

    const { id, tenantId, displayName, email, phone, website, tags } = result.data;
    const customFields = (result.data as any).customFields || {};

    try {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return { success: false, error: "Unauthorized" };

        // 1. Fetch current data via RPC (Bypassing RLS select policy)
        const { data: currentProfile, error: fetchError } = await supabase.rpc('fetch_organization_profile', {
            arg_tenant_id: tenantId,
            arg_org_id: id
        });

        if (fetchError) throw new Error(fetchError.message);
        // RPC returns array, usually 1 item if found
        const currentCard = currentProfile && currentProfile.length > 0 ? currentProfile[0] : null;

        if (!currentCard) return { success: false, error: "Organization not found" };

        // 2. Prepare Updates
        // fetch_organization_profile returns specific fields, and we assume ret_custom_fields is jsonb
        const existingCustomFields = currentCard.ret_custom_fields || {};

        const updatedCustomFields = {
            ...existingCustomFields,
            ...customFields
        };

        // Map top-level fields to custom_fields for consistency
        if (website !== undefined) updatedCustomFields.website = website;
        if (email !== undefined) updatedCustomFields.email = email;
        if (phone !== undefined) updatedCustomFields.phone = phone;

        // Contact Methods: The RPC returns ret_contact_methods jsonb
        let currentContactMethods: any[] = [];
        const rawMethods = currentCard.ret_contact_methods;

        if (Array.isArray(rawMethods)) {
            currentContactMethods = [...rawMethods];
        } else if (rawMethods && typeof rawMethods === 'object') {
            Object.keys(rawMethods).forEach(key => {
                currentContactMethods.push({ type: key, value: rawMethods[key] });
            });
        }

        const upsertMethod = (type: string, value: string) => {
            const idx = currentContactMethods.findIndex((m: any) => m.type === type);
            if (idx >= 0) {
                if (value) currentContactMethods[idx].value = value;
                else currentContactMethods.splice(idx, 1);
            } else if (value) {
                currentContactMethods.push({ type, value });
            }
        };

        if (email !== undefined) upsertMethod('email', email);
        if (phone !== undefined) upsertMethod('phone', phone);

        // 3. Update via RPC (Bypassing RLS update policy)
        const { data: success, error: updateError } = await supabase.rpc('update_organization_profile', {
            arg_tenant_id: tenantId,
            arg_org_id: id,
            arg_display_name: displayName,
            arg_status: updatedCustomFields.status,
            arg_tags: tags,
            arg_custom_fields: updatedCustomFields,
            arg_contact_methods: currentContactMethods
        });

        if (updateError) throw new Error(updateError.message);

        if (!success) {
            return { success: false, error: "Update failed (Record not modified)" };
        }

        revalidatePath(`/dashboard/organizations/${id}`);
        revalidatePath('/dashboard/organizations');

        return { success: true };

    } catch (error: any) {
        console.error("updateOrganization Error:", error);
        return { success: false, error: error.message };
    }
}
