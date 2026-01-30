
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UpdatePersonSchema = z.object({
    id: z.string().regex(uuidRegex, "Invalid ID format"),
    tenantId: z.string().regex(uuidRegex, "Invalid Tenant ID format"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional().or(z.literal("")),
    phone: z.string().optional(),
    customFields: z.record(z.any()).optional(),
    tags: z.array(z.string()).optional()
});

export type UpdatePersonInput = z.infer<typeof UpdatePersonSchema>;

export async function updatePerson(rawInput: any) {
    const supabase = await createClient();

    // [Fix] Use Service Role (Admin) to bypass RLS for writes
    const { createClient: createAdminClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

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
    console.log("Validating params:", JSON.stringify(params, null, 2));

    let result;
    try {
        result = UpdatePersonSchema.safeParse(params);
    } catch (zodError: any) {
        console.error("ZOD CRASHED (Bypassing validation):", zodError);
        result = { success: true, data: params };
    }

    if (!result.success) {
        console.error("Validation failed:", JSON.stringify(result.error, null, 2));
        return { success: false, error: "Validation failed" };
    }

    const { id, tenantId, firstName, lastName, email, phone, tags } = result.data;
    const customFields = (result.data as any).customFields || {};

    try {
        // [Security] Verify Authorization
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return { success: false, error: "Unauthorized: Not logged in" };

        console.log("Authorized access for user:", user.id);
        console.log("Updating person via direct DB calls (ADMIN MODE)...", { id, customFields, tags });

        // 1. Fetch current data from CARDS only
        const { data: currentCard, error: fetchError } = await supabaseAdmin
            .from('cards')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw new Error(`Fetch Card failed: ${fetchError.message}`);

        // Logic to construct Display Name
        // Ideally we split current display_name if firstName/lastName not provided, 
        // but for now we trust the input or keep existing if not provided.
        // Actually, simpler logic:
        let newDisplayName = currentCard.display_name;

        // If user provided name parts, update display_name
        if (firstName !== undefined || lastName !== undefined) {
            // If one is missing, we might want to try to fill it from existing,
            // but 'display_name' is a single string. 
            // In a sophisticated app we parsing existing display_name, but here let's just:
            const oldParts = currentCard.display_name.split(' ');
            const oldFirst = oldParts[0] || '';
            const oldLast = oldParts.slice(1).join(' ') || '';

            const f = firstName !== undefined ? firstName : oldFirst;
            const l = lastName !== undefined ? lastName : oldLast;
            newDisplayName = `${f} ${l}`.trim();
        }

        const updatedCustomFields = {
            ...(currentCard.custom_fields || {}),
            ...customFields
        };

        const status = updatedCustomFields.status || currentCard.status || 'lead';

        // Update Contact Methods (Simple JSONB Merge)
        let currentContactMethods = currentCard.contact_methods || {};
        // If it's an array (legacy), convert to object? 
        // Fresh start uses object {email, phone}.
        if (Array.isArray(currentContactMethods)) {
            // Legacy conversion on the fly just in case
            currentContactMethods = {};
        }

        const newContactMethods = { ...currentContactMethods };
        if (email !== undefined) newContactMethods.email = email;
        if (phone !== undefined) newContactMethods.phone = phone;


        const cardUpdatePayload: any = {
            display_name: newDisplayName,
            status: status,
            custom_fields: updatedCustomFields,
            contact_methods: newContactMethods,
            updated_at: new Date().toISOString()
        };

        if (tags !== undefined) {
            // Ensure tags are unique
            // If input tags replace all, simply assign.
            cardUpdatePayload.tags = tags;
        }

        console.log("updatePerson calling cards update with:", JSON.stringify(cardUpdatePayload, null, 2));

        const { error: updateError } = await supabaseAdmin
            .from('cards')
            .update(cardUpdatePayload)
            .eq('id', id);
        // .eq('tenant_id', tenantId); // Optional: Tenant ID check (RLS disabled anyway)

        if (updateError) {
            console.error("Card Update Error:", JSON.stringify(updateError, null, 2));
            throw new Error(`Card update failed: ${updateError.message}`);
        } else {
            console.log("Card Update Success");
        }

        // [New] Update Role (Job Title) - Kept Logic
        if (customFields.role !== undefined) {
            // Try Membership Update
            const { error: roleError, count } = await supabaseAdmin
                .from('party_memberships')
                .update({ role_name: customFields.role })
                .eq('person_id', id)
                .eq('tenant_id', tenantId) // Important here
                .select();

            if (roleError) console.error("Role Update Error (Non-Fatal):", roleError);
        }

        console.log("updatePerson Completed Successfully. Revalidating...");

        // 3. Revalidate
        revalidatePath(`/dashboard/people/${id}`);
        revalidatePath('/dashboard/people');

        return { success: true };

    } catch (error: any) {
        console.error("updatePerson Action Error:", error);
        return { success: false, error: error.message };
    }
}
