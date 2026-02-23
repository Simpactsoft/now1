"use server";

import { createClient } from "@/lib/supabase/server";
import { CreateOrganizationSchema, CreateOrganizationInput } from "@/lib/schemas";
import { revalidatePath } from "next/cache";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

export async function createOrganization(params: CreateOrganizationInput): Promise<ActionResult<any>> {
    const supabase = await createClient();

    // 1. Validate Input
    const result = CreateOrganizationSchema.safeParse(params);
    if (!result.success) {
        const errorMessage = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return actionError(errorMessage, "VALIDATION_ERROR");
    }

    const { name, taxId, companySize, industry, email, phone, address, tenantId, status } = result.data;

    try {
        // 2. Call RPC
        // Uses "God Mode" RPC (Security Definer)
        const { data, error } = await supabase.rpc('create_organization', {
            arg_tenant_id: tenantId,
            arg_name: name,
            arg_tax_id: taxId || null,
            arg_company_size: companySize || null,
            arg_industry: industry || null,
            arg_email: email || null,
            arg_phone: phone || null,
            arg_address: address || null,
            arg_status: (status && status.toUpperCase() !== 'LEAD') ? status : 'PROSPECT'
        });

        if (error) throw error;

        // 3. Revalidate & Return
        revalidatePath('/dashboard/people'); // Assuming organizations are also listed here or in a similar grid
        return actionSuccess(data);

    } catch (error: any) {
        console.error("createOrganization Error:", error);
        return actionError(error.message, "DB_ERROR");
    }
}
