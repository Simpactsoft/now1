"use server";

import { createClient } from "@/lib/supabase/server";
import type { TemplatePreset } from "./template-actions";
import { selectedOptionsSchema } from "@/lib/schemas/selected-options";

// ============================================================================
// TYPES
// ============================================================================

interface CreatePresetParams {
    name: string;
    description?: string;
    selectedOptions: Record<string, string>;
    imageUrl?: string;
    badgeText?: string;
    displayOrder?: number;
}

interface UpdatePresetParams {
    name?: string;
    description?: string;
    selectedOptions?: Record<string, string>;
    imageUrl?: string;
    badgeText?: string;
    displayOrder?: number;
    cachedTotalPrice?: number;
    isActive?: boolean;
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Create a new preset for a template.
 */
export async function createPreset(
    templateId: string,
    params: CreatePresetParams
): Promise<{ success: boolean; data?: TemplatePreset; error?: string }> {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // Verify template exists and get tenant_id
        const { data: template, error: templateError } = await supabase
            .from("product_templates")
            .select("id, tenant_id")
            .eq("id", templateId)
            .single();

        if (templateError || !template) {
            return { success: false, error: "Template not found" };
        }

        const selectedOptionsValidation = selectedOptionsSchema.safeParse(params.selectedOptions);
        if (!selectedOptionsValidation.success) {
            return { success: false, error: `Invalid selected_options: ${selectedOptionsValidation.error.errors[0].message}` };
        }

        // Get next display_order if not specified
        let displayOrder = params.displayOrder;
        if (displayOrder === undefined) {
            const { data: maxPreset } = await supabase
                .from("template_presets")
                .select("display_order")
                .eq("template_id", templateId)
                .order("display_order", { ascending: false })
                .limit(1)
                .single();

            displayOrder = (maxPreset?.display_order || 0) + 1;
        }

        const { data, error } = await supabase
            .from("template_presets")
            .insert({
                tenant_id: template.tenant_id,
                template_id: templateId,
                name: params.name,
                description: params.description || null,
                selected_options: params.selectedOptions,
                image_url: params.imageUrl || null,
                badge_text: params.badgeText || null,
                display_order: displayOrder,
                is_active: true,
            })
            .select("*")
            .single();

        if (error) {
            console.error("Error creating preset:", error);
            return { success: false, error: error.message };
        }

        return { success: true, data: mapPresetFromDb(data) };
    } catch (error: any) {
        console.error("Error in createPreset:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Update an existing preset.
 */
export async function updatePreset(
    presetId: string,
    params: UpdatePresetParams
): Promise<{ success: boolean; data?: TemplatePreset; error?: string }> {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        if (params.selectedOptions !== undefined) {
            const selectedOptionsValidation = selectedOptionsSchema.safeParse(params.selectedOptions);
            if (!selectedOptionsValidation.success) {
                return { success: false, error: `Invalid selected_options: ${selectedOptionsValidation.error.errors[0].message}` };
            }
        }

        const updateData: any = {
            updated_at: new Date().toISOString(),
        };

        if (params.name !== undefined) updateData.name = params.name;
        if (params.description !== undefined) updateData.description = params.description || null;
        if (params.selectedOptions !== undefined) updateData.selected_options = params.selectedOptions;
        if (params.imageUrl !== undefined) updateData.image_url = params.imageUrl || null;
        if (params.badgeText !== undefined) updateData.badge_text = params.badgeText || null;
        if (params.displayOrder !== undefined) updateData.display_order = params.displayOrder;
        if (params.cachedTotalPrice !== undefined) updateData.cached_total_price = params.cachedTotalPrice;
        if (params.isActive !== undefined) updateData.is_active = params.isActive;

        const { data, error } = await supabase
            .from("template_presets")
            .update(updateData)
            .eq("id", presetId)
            .select("*")
            .single();

        if (error) {
            console.error("Error updating preset:", error);
            return { success: false, error: error.message };
        }

        return { success: true, data: mapPresetFromDb(data) };
    } catch (error: any) {
        console.error("Error in updatePreset:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a preset.
 */
export async function deletePreset(
    presetId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        const { error } = await supabase
            .from("template_presets")
            .delete()
            .eq("id", presetId);

        if (error) {
            console.error("Error deleting preset:", error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error in deletePreset:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Toggle a preset's active status.
 */
export async function togglePresetActive(
    presetId: string
): Promise<{ success: boolean; data?: { isActive: boolean }; error?: string }> {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        const { data: preset, error: fetchError } = await supabase
            .from("template_presets")
            .select("is_active")
            .eq("id", presetId)
            .single();

        if (fetchError || !preset) {
            return { success: false, error: "Preset not found" };
        }

        const newStatus = !preset.is_active;

        const { error } = await supabase
            .from("template_presets")
            .update({ is_active: newStatus, updated_at: new Date().toISOString() })
            .eq("id", presetId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, data: { isActive: newStatus } };
    } catch (error: any) {
        console.error("Error in togglePresetActive:", error);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// HELPERS
// ============================================================================

function mapPresetFromDb(p: any): TemplatePreset {
    return {
        id: p.id,
        templateId: p.template_id,
        name: p.name,
        description: p.description,
        selectedOptions: p.selected_options as Record<string, string>,
        displayOrder: p.display_order,
        imageUrl: p.image_url,
        badgeText: p.badge_text,
        cachedTotalPrice: p.cached_total_price ? parseFloat(p.cached_total_price) : null,
        isActive: p.is_active,
    };
}
