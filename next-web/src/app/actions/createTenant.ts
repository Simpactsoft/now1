"use server";

import { createClient } from "@/lib/supabase/server";
import { CreateTenantSchema, CreateTenantInput } from "@/lib/schemas";
import { revalidatePath } from "next/cache";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

export async function createTenant(params: CreateTenantInput): Promise<ActionResult<any>> {
    const supabase = await createClient();

    // 1. Validate Input
    const result = CreateTenantSchema.safeParse(params);
    if (!result.success) {
        const errorMessage = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return actionError(errorMessage, "VALIDATION_ERROR");
    }

    const { name, slug } = result.data;

    try {
        // 2. Call RPC
        // Using simplified RPC which now only expects Name and Slug (English enforced)
        const { data, error } = await supabase.rpc('create_tenant_platform', {
            arg_name: name,
            arg_slug: slug || null
        });

        if (error) throw error;

        // 3. Revalidate & Return
        revalidatePath('/dashboard/admin');
        return actionSuccess(data);

    } catch (error: any) {
        console.error("createTenant Error:", error);
        return actionError(error.message, "DB_ERROR");
    }
}
