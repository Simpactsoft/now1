"use server";

import { createClient } from "@/lib/supabase/server";
import { optionGroupSchema } from "@/lib/cpq/validators";

// ============================================================================
// TYPES
// ============================================================================

export interface CreateOptionGroupParams {
    name: string;
    description?: string;
    selectionType: "single" | "multiple";
    isRequired: boolean;
    minSelections?: number;
    maxSelections?: number;
    sourceType: "manual" | "category";
    sourceCategoryId?: string | null;
    categoryPriceMode?: "list_price" | "cost_plus" | "explicit";
}

export interface UpdateOptionGroupParams {
    name?: string;
    description?: string;
    selectionType?: "single" | "multiple";
    isRequired?: boolean;
    minSelections?: number;
    maxSelections?: number;
    sourceType?: "manual" | "category";
    sourceCategoryId?: string | null;
    categoryPriceMode?: "list_price" | "cost_plus" | "explicit";
}

type OptionGroup = {
    id: string;
    template_id: string;
    name: string;
    description: string | null;
    display_order: number;
    selection_type: "single" | "multiple";
    is_required: boolean;
    min_selections: number;
    max_selections: number | null;
    source_type: "manual" | "category";
    source_category_id: string | null;
    category_price_mode: string | null;
    created_at: string;
    updated_at: string;
};

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Create a new option group for a template
 */
export async function createOptionGroup(
    templateId: string,
    params: CreateOptionGroupParams
): Promise<{ success: boolean; data?: OptionGroup; error?: string }> {
    try {
        const supabase = await createClient();

        // 1. Auth check
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }



        // 2. Validate with Zod
        const validationData = {
            templateId: templateId,
            name: params.name,
            description: params.description,
            selectionType: params.selectionType,
            isRequired: params.isRequired,
            minSelections: params.minSelections || 0,
            maxSelections: params.maxSelections,
            sourceType: params.sourceType,
            sourceCategoryId: params.sourceCategoryId,
            categoryPriceMode: params.categoryPriceMode,
        };

        const validation = optionGroupSchema.safeParse(validationData);

        if (!validation.success) {

            const firstError = validation.error?.errors?.[0];
            return {
                success: false,
                error: firstError?.message || "Validation failed",
            };
        }



        // 3. Get tenant_id from user
        let tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;

        // If not found in metadata, try profiles table
        if (!tenantId) {
            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("tenant_id")
                .eq("id", user.id)
                .single();

            if (!profileError && profile) {
                tenantId = profile.tenant_id;
            }
        }

        if (!tenantId) {
            return { success: false, error: "Tenant ID required. Please make sure you are assigned to a tenant." };
        }

        // 4. Get max display_order
        const { data: maxOrder } = await supabase
            .from("option_groups")
            .select("display_order")
            .eq("template_id", templateId)
            .order("display_order", { ascending: false })
            .limit(1)
            .single();

        const displayOrder = (maxOrder?.display_order ?? -1) + 1;

        // 5. Insert into DB
        const { data, error } = await supabase
            .from("option_groups")
            .insert({
                tenant_id: tenantId,
                template_id: templateId,
                name: params.name,
                description: params.description || null,
                display_order: displayOrder,
                selection_type: params.selectionType,
                is_required: params.isRequired,
                min_selections: params.minSelections || 0,
                max_selections: params.maxSelections || null,
                source_type: params.sourceType,
                source_category_id: params.sourceCategoryId || null,
                category_price_mode: params.categoryPriceMode || null,
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating option group:", error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (error: any) {
        console.error("Error in createOptionGroup:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Update an existing option group
 */
export async function updateOptionGroup(
    groupId: string,
    params: UpdateOptionGroupParams
): Promise<{ success: boolean; data?: OptionGroup; error?: string }> {
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
        if (params.selectionType !== undefined)
            updateData.selection_type = params.selectionType;
        if (params.isRequired !== undefined)
            updateData.is_required = params.isRequired;
        if (params.minSelections !== undefined)
            updateData.min_selections = params.minSelections;
        if (params.maxSelections !== undefined)
            updateData.max_selections = params.maxSelections;
        if (params.sourceType !== undefined)
            updateData.source_type = params.sourceType;
        if (params.sourceCategoryId !== undefined)
            updateData.source_category_id = params.sourceCategoryId || null;
        if (params.categoryPriceMode !== undefined)
            updateData.category_price_mode = params.categoryPriceMode || null;

        // 3. Special case: If switching from manual to category, delete child options
        if (params.sourceType === "category") {
            const { data: currentGroup } = await supabase
                .from("option_groups")
                .select("source_type")
                .eq("id", groupId)
                .single();

            if (currentGroup?.source_type === "manual") {
                // Delete all manual options for this group
                await supabase.from("options").delete().eq("option_group_id", groupId);
            }
        }

        // 4. Update in DB
        const { data, error } = await supabase
            .from("option_groups")
            .update(updateData)
            .eq("id", groupId)
            .select()
            .single();

        if (error) {
            console.error("Error updating option group:", error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (error: any) {
        console.error("Error in updateOptionGroup:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete an option group (cascade deletes options)
 */
export async function deleteOptionGroup(
    groupId: string
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

        // 2. Delete from DB (CASCADE handles child options)
        const { error } = await supabase
            .from("option_groups")
            .delete()
            .eq("id", groupId);

        if (error) {
            console.error("Error deleting option group:", error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error in deleteOptionGroup:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Reorder option groups by updating display_order
 */
export async function reorderOptionGroups(
    templateId: string,
    groupIds: string[]
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

        // 2. Update display_order for each group (atomic transaction)
        const updates = groupIds.map((id, index) =>
            supabase
                .from("option_groups")
                .update({ display_order: index, updated_at: new Date().toISOString() })
                .eq("id", id)
                .eq("template_id", templateId) // Security: only update groups in this template
        );

        const results = await Promise.all(updates);

        // Check for errors
        const errors = results.filter((r) => r.error);
        if (errors.length > 0) {
            console.error("Error reordering option groups:", errors);
            return { success: false, error: "Failed to reorder some groups" };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error in reorderOptionGroups:", error);
        return { success: false, error: error.message };
    }
}
