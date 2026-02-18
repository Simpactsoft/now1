"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { customFieldsSchema } from "@/lib/schemas/custom-fields";
import { ActionResult, actionOk, actionError } from "@/lib/action-result";

const UpdateOrgSchema = z.object({
    id: z.string(),
    tenantId: z.string(),
    displayName: z.string().optional(),
    email: z.string().nullish(), // string | null | undefined
    phone: z.string().nullish(),
    website: z.string().nullish(),
    customFields: z.record(z.string(), z.any()).optional(),
    tags: z.array(z.string()).optional()
});

export type UpdateOrgInput = z.infer<typeof UpdateOrgSchema>;

export async function updateOrganization(rawInput: any): Promise<ActionResult<void>> {
    console.log("[updateOrganization] Received Raw Input:", JSON.stringify(rawInput, null, 2));
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
    const result = UpdateOrgSchema.safeParse(params);

    if (!result.success) {
        console.error("Validation Failed:", result.error);
        const firstError = result.error.errors[0];
        const errorMessage = firstError ? `${firstError.path.join('.')}: ${firstError.message}` : "Validation failed";
        return actionError(errorMessage, "VALIDATION_ERROR");
    }

    const { id, tenantId, displayName, email, phone, website, tags, customFields: inputCustomFields } = result.data;
    const customFields = inputCustomFields || {};

    try {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return actionError("Unauthorized", "AUTH_ERROR");

        // 1. Fetch current data (WITH RLS)
        const { data: currentCard, error: fetchError } = await supabase
            .from('cards')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', tenantId) // Ensure tenant match
            .single();

        if (fetchError) {
            console.error("Fetch Error:", fetchError);
            return actionError(`Fetch failed: ${fetchError.message}`, "DB_ERROR");
        }

        if (!currentCard) {
            return actionError("Organization not found", "NOT_FOUND");
        }

        const cardData = currentCard;
        const lastKnownUpdatedAt = cardData.updated_at;

        // 2. Prepare Updates
        const existingCustomFields = cardData.custom_fields || {};

        const updatedCustomFields = {
            ...existingCustomFields,
            ...customFields
        };

        // Map top-level fields to custom_fields for consistency
        if (website !== undefined) updatedCustomFields.website = website;
        if (email !== undefined) updatedCustomFields.email = email;
        if (phone !== undefined) updatedCustomFields.phone = phone;

        const customFieldsValidation = customFieldsSchema.safeParse(updatedCustomFields);
        if (!customFieldsValidation.success) {
            return actionError(`Invalid custom_fields: ${customFieldsValidation.error.errors[0].message}`, "VALIDATION_ERROR");
        }

        // Ensure Status is Uppercase
        let newStatus = updatedCustomFields.status || cardData.status || 'PROSPECT';
        if (newStatus) newStatus = newStatus.toUpperCase();

        // Update Contact Methods
        let currentContactMethods = cardData.contact_methods || {};
        if (Array.isArray(currentContactMethods)) {
            currentContactMethods = {};
        }

        const newContactMethods = { ...currentContactMethods };
        if (email !== undefined) newContactMethods.email = email;
        if (phone !== undefined) newContactMethods.phone = phone;
        if (website !== undefined) newContactMethods.website = website;

        const cardUpdatePayload: any = {
            display_name: displayName !== undefined ? displayName : cardData.display_name,
            status: newStatus,
            custom_fields: updatedCustomFields,
            contact_methods: newContactMethods,
            updated_at: new Date().toISOString()
        };

        if (tags !== undefined) {
            cardUpdatePayload.tags = tags;
        }

        console.log("updateOrganization calling cards update with:", JSON.stringify(cardUpdatePayload, null, 2));

        // 3. Update via Direct Table Access with Optimistic Locking
        // Note: We relaxed strict optimistic locking for improved UX if lastKnownUpdatedAt is null/old,
        // but generally it's good practice. For now, trusting RLS and ID.
        const { data: updatedRows, error: updateError } = await supabase
            .from('cards')
            .update(cardUpdatePayload)
            .eq('id', id)
            // .eq('updated_at', lastKnownUpdatedAt) // Relaxed for debugging ease, re-enable if high concurrency needed
            .select();

        if (updateError) throw new Error(updateError.message);

        if (!updatedRows || updatedRows.length === 0) {
            // If we relaxed optimistic locking but still got 0, it means ID/Tenant didn't match or RLS blocked.
            return actionError("Update failed (Record not found or access denied)", "NOT_FOUND");
        }

        revalidatePath(`/dashboard/organizations/${id}`);
        revalidatePath('/dashboard/organizations');

        return actionOk();

    } catch (error: any) {
        console.error("updateOrganization Error:", error);
        return actionError(error.message, "DB_ERROR");
    }
}
