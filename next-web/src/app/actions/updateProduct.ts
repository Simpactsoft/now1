"use server";

import { createClient } from "@/lib/supabase/server";

interface UpdateProductParams {
    id: string;
    tenantId: string;
    name: string;
    sku: string;
    list_price?: number;
    cost_price?: number;
    description?: string;
    track_inventory?: boolean;
    is_configurable?: boolean;
    template_id?: string;
}

export async function updateProduct(params: UpdateProductParams) {
    try {
        const supabase = await createClient();

        // 1. Validate auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: "Unauthorized" };
        }

        // 2. Perform the update
        const { data, error } = await supabase
            .from("products")
            .update({
                name: params.name,
                sku: params.sku,
                list_price: params.list_price,
                cost_price: params.cost_price,
                description: params.description,
                track_inventory: params.track_inventory,
                is_configurable: params.is_configurable,
                template_id: params.template_id,
            })
            .eq("id", params.id)
            .eq("tenant_id", params.tenantId)
            .select()
            .single();

        if (error) {
            console.error("Failed to update product:", error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (error: any) {
        console.error("Error in updateProduct:", error);
        return { success: false, error: error.message };
    }
}
