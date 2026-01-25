"use server";

import { createClient } from "@/lib/supabase/server";
import { CreatePersonSchema, CreatePersonInput } from "@/lib/schemas";
import { revalidatePath } from "next/cache";

export async function createPerson(params: CreatePersonInput) {
    const supabase = await createClient();

    // 1. Validate Input
    console.log("createPerson params:", params);
    console.log("CreatePersonSchema:", CreatePersonSchema);

    // Check if schema is defined
    if (!CreatePersonSchema) {
        console.error("CreatePersonSchema is UNDEFINED");
        return { success: false, error: "Server Configuration Error: Schema undefined" };
    }

    let result;
    try {
        result = CreatePersonSchema.safeParse(params);
    } catch (e) {
        console.error("CreatePersonSchema.safeParse CRASHED:", e);
        return { success: false, error: "Server Validation System Error" };
    }

    if (!result.success) {
        const errorMessage = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return { success: false, error: errorMessage };
    }

    const { firstName, lastName, email, phone, tenantId } = result.data;

    try {
        // 2. Call RPC - Attempt with NEW signature (supports custom_fields)
        const { data, error } = await supabase.rpc('create_person', {
            arg_tenant_id: tenantId,
            arg_first_name: firstName,
            arg_last_name: lastName,
            arg_email: email || null,
            arg_phone: phone || null,
            arg_custom_fields: (result.data as any).customFields || {}
        });

        if (error) {
            // Check for Schema Mismatch (function not found)
            if (error.message?.includes('Could not find the function')) {
                console.warn("createPerson: RPC signature mismatch. Falling back to legacy signature.");

                // Fallback: Call OLD signature
                const { data: fallbackData, error: fallbackError } = await supabase.rpc('create_person', {
                    arg_tenant_id: tenantId,
                    arg_first_name: firstName,
                    arg_last_name: lastName,
                    arg_email: email || null,
                    arg_phone: phone || null
                });

                if (fallbackError) throw fallbackError;

                // Post-process: Update custom_fields manually since RPC didn't take them
                if (result.data.customFields && Object.keys(result.data.customFields).length > 0) {
                    console.log("createPerson: Manually updating custom_fields for", fallbackData.id);
                    await supabase.from('parties').update({
                        custom_fields: result.data.customFields
                    }).eq('id', fallbackData.id);
                }

                revalidatePath('/dashboard/people');
                return { success: true, data: fallbackData };
            }
            throw error;
        }

        // 3. Revalidate & Return
        revalidatePath('/dashboard/people');
        return { success: true, data };

    } catch (error: any) {
        console.error("createPerson Error:", error);
        return { success: false, error: error.message };
    }
}
