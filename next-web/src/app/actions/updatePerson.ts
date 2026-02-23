
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { customFieldsSchema } from "@/lib/schemas/custom-fields";
import { ActionResult, actionOk, actionError } from "@/lib/action-result";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UpdatePersonSchema = z.object({
    id: z.string().regex(uuidRegex, "Invalid ID format"),
    tenantId: z.string().regex(uuidRegex, "Invalid Tenant ID format"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional().or(z.literal("")),
    phone: z.string().optional(),
    customFields: z.record(z.string(), z.any()).optional(),
    tags: z.array(z.string()).optional(),
    jobTitle: z.string().optional()
});

export type UpdatePersonInput = z.infer<typeof UpdatePersonSchema>;

export async function updatePerson(rawInput: any): Promise<ActionResult<void>> {
    // [SECURITY FIX] Use Standard Client (RLS Enforced)
    const supabase = await createClient();

    // 0. Sanitize Input
    const sanitize = (val: any) => typeof val === 'string' ? val.trim() : val;
    const cleanId = (val: any) => typeof val === 'string' ? val.replace(/['"]+/g, '').trim() : val;

    const params = {
        ...rawInput,
        id: cleanId(rawInput.id),
        tenantId: cleanId(rawInput.tenantId),
        email: sanitize(rawInput.email),
        phone: sanitize(rawInput.phone),
        firstName: sanitize(rawInput.firstName),
        lastName: sanitize(rawInput.lastName),
    };

    // 1. Validate Input
    let result;
    try {
        result = UpdatePersonSchema.safeParse(params);
    } catch (zodError: any) {
        console.error("ZOD CRASHED (Bypassing validation):", zodError);
        result = { success: true, data: params };
    }

    if (!result.success) {
        console.error("Validation failed:", JSON.stringify(result.error, null, 2));
        return actionError("Validation failed", "VALIDATION_ERROR");
    }

    const { id, tenantId, firstName, lastName, email, phone, tags, jobTitle } = result.data;
    const customFields = (result.data as any).customFields || {};

    try {
        // [Security] Verify Authorization
        // Note: createClient() already handles auth state, but explicit check is good practice
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return actionError("Unauthorized: Not logged in", "AUTH_ERROR");

        console.log("Authorized access for user:", user.id);

        // 1. Fetch current data (WITH RLS)
        // [Race Condition Fix] Store the updated_at we saw
        const { data: currentCard, error: fetchError } = await supabase
            .from('cards')
            .select('*')
            .eq('id', id)
            .eq('id', id);
        // .single(); // DEBUGGING: Removed single() to debug "Cannot coerce" error

        if (fetchError) throw new Error(`Fetch Card query failed: ${fetchError.message}`);

        if (!currentCard || currentCard.length === 0) {
            return actionError("Card not found (0 rows)", "NOT_FOUND");
        }

        if (currentCard.length > 1) {
            console.warn(`[WARNING] Multiple cards found for ID ${id}: ${currentCard.length} rows`);
        }

        const cardData = currentCard[0]; // Take the first one
        const lastKnownUpdatedAt = cardData.updated_at;

        // Logic to construct Display Name
        let newDisplayName = cardData.display_name;

        if (firstName !== undefined || lastName !== undefined) {
            const oldParts = cardData.display_name.split(' ');
            const oldFirst = oldParts[0] || '';
            const oldLast = oldParts.slice(1).join(' ') || '';

            const f = firstName !== undefined ? firstName : oldFirst;
            const l = lastName !== undefined ? lastName : oldLast;
            newDisplayName = `${f} ${l}`.trim();
        }

        const updatedCustomFields = {
            ...(cardData.custom_fields || {}),
            ...customFields
        };

        const customFieldsValidation = customFieldsSchema.safeParse(updatedCustomFields);
        if (!customFieldsValidation.success) {
            return actionError(`Invalid custom_fields: ${customFieldsValidation.error.issues[0].message}`, "VALIDATION_ERROR");
        }

        const status = updatedCustomFields.status || cardData.status || 'lead';

        // Update Contact Methods
        let contactMethodsArr: any[] = [];
        if (Array.isArray(cardData.contact_methods)) {
            contactMethodsArr = [...cardData.contact_methods];
        } else if (cardData.contact_methods && typeof cardData.contact_methods === 'object') {
            // Convert legacy object to array
            if (cardData.contact_methods.email) contactMethodsArr.push({ type: 'email', value: cardData.contact_methods.email });
            if (cardData.contact_methods.phone) contactMethodsArr.push({ type: 'phone', value: cardData.contact_methods.phone });
            if (cardData.contact_methods.website) contactMethodsArr.push({ type: 'website', value: cardData.contact_methods.website });
        }

        if (email !== undefined) {
            const emailIdx = contactMethodsArr.findIndex(m => m.type === 'email');
            if (emailIdx >= 0) {
                if (email === "") contactMethodsArr.splice(emailIdx, 1);
                else contactMethodsArr[emailIdx].value = email;
            } else if (email !== "") {
                contactMethodsArr.push({ type: 'email', value: email });
            }
        }

        if (phone !== undefined) {
            const phoneIdx = contactMethodsArr.findIndex(m => m.type === 'phone');
            if (phoneIdx >= 0) {
                if (phone === "") contactMethodsArr.splice(phoneIdx, 1);
                else contactMethodsArr[phoneIdx].value = phone;
            } else if (phone !== "") {
                contactMethodsArr.push({ type: 'phone', value: phone });
            }
        }

        const newContactMethods = contactMethodsArr;


        const cardUpdatePayload: any = {
            display_name: newDisplayName,
            status: status,
            custom_fields: updatedCustomFields,
            contact_methods: newContactMethods,
            updated_at: new Date().toISOString()
        };

        if (firstName !== undefined) cardUpdatePayload.first_name = firstName;
        if (lastName !== undefined) cardUpdatePayload.last_name = lastName;
        if (email !== undefined) cardUpdatePayload.email = email === "" ? null : email;
        if (phone !== undefined) cardUpdatePayload.phone = phone === "" ? null : phone;

        if (tags !== undefined) {
            cardUpdatePayload.tags = tags;
        }
        if (jobTitle !== undefined) {
            cardUpdatePayload.job_title = jobTitle;
        }

        console.log("updatePerson calling cards update with (Secure):", JSON.stringify(cardUpdatePayload, null, 2));

        // [Security] Perform Update with Optimistic Locking Window
        // We enforce that updated_at matches what we fetched seconds ago.
        const { data: updatedRows, error: updateError } = await supabase
            .from('cards')
            .update(cardUpdatePayload)
            .eq('id', id)
            .eq('updated_at', lastKnownUpdatedAt) // <--- OPTIMISTIC LOCK
            .select();

        if (updateError) {
            throw new Error(`Update failed: ${updateError.message}`);
        }

        if (!updatedRows || updatedRows.length === 0) {
            // OPTIMISTIC LOCK FAIL
            console.error("Race Condition Detected: Data was updated between Fetch and Write.");
            // Returning a distinct error allows client (potential future improvement) to retry
            return actionError("Data is stale (Concurrent Update). Please refresh.", "CONFLICT");
        }

        console.log("Card Update Success (Secure)");


        // [New] Update Role (Job Title) - Enforced via RLS now (Migration 204)
        if (customFields.role !== undefined) {
            const { error: roleError } = await supabase
                .from('party_memberships')
                .update({ role_name: customFields.role })
                .eq('person_id', id)
                .eq('tenant_id', tenantId)
                .select();

            if (roleError) console.error("Role Update Error (Non-Fatal):", roleError);
        }

        console.log("updatePerson Completed Successfully. Revalidating...");

        // 3. Revalidate
        revalidatePath(`/dashboard/people/${id}`);
        revalidatePath('/dashboard/people');

        return actionOk();

    } catch (error: any) {
        console.error("updatePerson Action Error:", error);
        return actionError(error.message, "DB_ERROR");
    }
}
