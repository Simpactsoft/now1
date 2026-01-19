"use server";

import { createClient } from "@/lib/supabase/server";
import { CreatePersonSchema, CreatePersonInput } from "@/lib/schemas";
import { revalidatePath } from "next/cache";

export async function createPerson(params: CreatePersonInput) {
    const supabase = await createClient();

    // 1. Validate Input
    const result = CreatePersonSchema.safeParse(params);
    if (!result.success) {
        const errorMessage = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return { success: false, error: errorMessage };
    }

    const { firstName, lastName, email, phone, tenantId } = result.data;

    try {
        // 2. Call RPC
        const { data, error } = await supabase.rpc('create_person', {
            arg_tenant_id: tenantId,
            arg_first_name: firstName,
            arg_last_name: lastName,
            arg_email: email || null,
            arg_phone: phone || null
        });

        if (error) throw error;

        // 3. Revalidate & Return
        revalidatePath('/dashboard/people');
        return { success: true, data };

    } catch (error: any) {
        console.error("createPerson Error:", error);
        return { success: false, error: error.message };
    }
}
