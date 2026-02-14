"use server";

import { createClient } from "@/lib/supabase/server";
import { optionSchema } from "@/lib/cpq/validators";

// ============================================================================
// TYPES
// ============================================================================

export interface CreateOptionParams {
    name: string;
    description?: string;
    sku?: string;
    priceModifierType: "add" | "multiply" | "replace";
    priceModifierValue: number;
    imageUrl?: string;
    isDefault?: boolean;
}

export interface UpdateOptionParams {
    name?: string;
    description?: string;
    sku?: string;
    priceModifierType?: "add" | "multiply" | "replace";
    priceModifierValue?: number;
    imageUrl?: string;
    isDefault?: boolean;
}

type Option = {
    id: string;
    option_group_id: string;
    name: string;
    description: string | null;
    sku: string | null;
    product_id: string | null;
    price_modifier_type: "add" | "multiply" | "replace";
    price_modifier_value: number;
    display_order: number;
    image_url: string | null;
    is_default: boolean;
    is_available: boolean;
    created_at: string;
    updated_at: string;
};

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Create a new option for a manual option group
 */
export async function createOption(
    groupId: string,
    params: CreateOptionParams
): Promise<{ success: boolean; data?: Option; error?: string }> {
    try {
        const supabase = await createClient();

        // 1. Auth check
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // 2. Verify group is manual (can't add options to category groups)
        const { data: group, error: groupError } = await supabase
            .from("option_groups")
            .select("source_type")
            .eq("id", groupId)
            .single();

        if (groupError || !group) {
            return { success: false, error: "Option group not found" };
        }

        if (group.source_type !== "manual") {
            return {
                success: false,
                error: "Cannot add options to category-sourced groups",
            };
        }

        // 3. Validate with Zod
        const validation = optionSchema.safeParse({
            name: params.name,
            description: params.description,
            sku: params.sku,
            priceModifierType: params.priceModifierType,
            priceModifierValue: params.priceModifierValue,
            imageUrl: params.imageUrl,
            isDefault: params.isDefault || false,
        });

        if (!validation.success) {
            return {
                success: false,
                error: validation.error.errors[0]?.message || "Validation failed",
            };
        }

        // 4. Get max display_order
        const { data: maxOrder } = await supabase
            .from("options")
            .select("display_order")
            .eq("option_group_id", groupId)
            .order("display_order", { ascending: false })
            .limit(1)
            .single();

        const displayOrder = (maxOrder?.display_order ?? -1) + 1;

        // 5. Insert into DB
        const { data, error } = await supabase
            .from("options")
            .insert({
                option_group_id: groupId,
                name: params.name,
                description: params.description || null,
                sku: params.sku || null,
                price_modifier_type: params.priceModifierType,
                price_modifier_value: params.priceModifierValue,
                display_order: displayOrder,
                image_url: params.imageUrl || null,
                is_default: params.isDefault || false,
                is_available: true,
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating option:", error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (error: any) {
        console.error("Error in createOption:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Update an existing option
 */
export async function updateOption(
    optionId: string,
    params: UpdateOptionParams
): Promise<{ success: boolean; data?: Option; error?: string }> {
    try {
        const supabase = await createClient();

        // 1. Auth check
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // 2. Build update object (only include provided fields)
        const updateData: any = {
            updated_at: new Date().toISOString(),
        };

        if (params.name !== undefined) updateData.name = params.name;
        if (params.description !== undefined)
            updateData.description = params.description || null;
        if (params.sku !== undefined) updateData.sku = params.sku || null;
        if (params.priceModifierType !== undefined)
            updateData.price_modifier_type = params.priceModifierType;
        if (params.priceModifierValue !== undefined)
            updateData.price_modifier_value = params.priceModifierValue;
        if (params.imageUrl !== undefined)
            updateData.image_url = params.imageUrl || null;
        if (params.isDefault !== undefined)
            updateData.is_default = params.isDefault;

        // 3. Update in DB
        const { data, error } = await supabase
            .from("options")
            .update(updateData)
            .eq("id", optionId)
            .select()
            .single();

        if (error) {
            console.error("Error updating option:", error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (error: any) {
        console.error("Error in updateOption:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete an option
 */
export async function deleteOption(
    optionId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        // 1. Auth check
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // 2. Delete from DB
        const { error } = await supabase.from("options").delete().eq("id", optionId);

        if (error) {
            console.error("Error deleting option:", error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error in deleteOption:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Reorder options within a group by updating display_order
 */
export async function reorderOptions(
    groupId: string,
    optionIds: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        // 1. Auth check
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // 2. Update display_order for each option (atomic transaction)
        const updates = optionIds.map((id, index) =>
            supabase
                .from("options")
                .update({ display_order: index, updated_at: new Date().toISOString() })
                .eq("id", id)
                .eq("option_group_id", groupId) // Security: only update options in this group
        );

        const results = await Promise.all(updates);

        // Check for errors
        const errors = results.filter((r) => r.error);
        if (errors.length > 0) {
            console.error("Error reordering options:", errors);
            return { success: false, error: "Failed to reorder some options" };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error in reorderOptions:", error);
        return { success: false, error: error.message };
    }
}
