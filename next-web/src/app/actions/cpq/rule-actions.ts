"use server";

import { createClient } from "@/lib/supabase/server";
import type { ConfigurationRule } from "./template-actions";
import { allowedOptionsSchema } from "@/lib/schemas/allowed-options";

// ============================================================================
// TYPES
// ============================================================================

interface CreateRuleParams {
    ruleType: "requires" | "conflicts" | "hides" | "auto_select" | "price_tier";
    name: string;
    description?: string;
    errorMessage?: string;
    ifOptionId?: string | null;
    ifGroupId?: string | null;
    thenOptionId?: string | null;
    thenGroupId?: string | null;
    allowedOptions?: string[] | null;
    quantityMin?: number | null;
    quantityMax?: number | null;
    discountType?: "percentage" | "fixed_amount" | null;
    discountValue?: number | null;
    priority?: number;
}

interface UpdateRuleParams {
    ruleType?: "requires" | "conflicts" | "hides" | "auto_select" | "price_tier";
    name?: string;
    description?: string;
    errorMessage?: string;
    ifOptionId?: string | null;
    ifGroupId?: string | null;
    thenOptionId?: string | null;
    thenGroupId?: string | null;
    allowedOptions?: string[] | null;
    quantityMin?: number | null;
    quantityMax?: number | null;
    discountType?: "percentage" | "fixed_amount" | null;
    discountValue?: number | null;
    priority?: number;
    isActive?: boolean;
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Create a new configuration rule for a template.
 */
export async function createRule(
    templateId: string,
    params: CreateRuleParams
): Promise<{ success: boolean; data?: ConfigurationRule; error?: string }> {
    try {
        const supabase = await createClient();

        // Auth check
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // Verify template exists and user has access (RLS handles tenant isolation)
        const { data: template, error: templateError } = await supabase
            .from("product_templates")
            .select("id")
            .eq("id", templateId)
            .single();

        if (templateError || !template) {
            return { success: false, error: "Template not found" };
        }

        // Get next priority if not specified
        let priority = params.priority;
        if (priority === undefined) {
            const { data: maxRule } = await supabase
                .from("configuration_rules")
                .select("priority")
                .eq("template_id", templateId)
                .order("priority", { ascending: false })
                .limit(1)
                .single();

            priority = (maxRule?.priority || 0) + 10;
        }

        if (params.allowedOptions !== undefined) {
            const allowedOptionsValidation = allowedOptionsSchema.safeParse(params.allowedOptions);
            if (!allowedOptionsValidation.success) {
                return { success: false, error: `Invalid allowed_options: ${allowedOptionsValidation.error.issues[0].message}` };
            }
        }

        // Insert the rule
        const { data, error } = await supabase
            .from("configuration_rules")
            .insert({
                template_id: templateId,
                rule_type: params.ruleType,
                name: params.name,
                description: params.description || null,
                error_message: params.errorMessage || null,
                if_option_id: params.ifOptionId || null,
                if_group_id: params.ifGroupId || null,
                if_product_id: null,
                then_option_id: params.thenOptionId || null,
                then_group_id: params.thenGroupId || null,
                then_product_id: null,
                allowed_options: params.allowedOptions || null,
                quantity_min: params.quantityMin ?? null,
                quantity_max: params.quantityMax ?? null,
                discount_type: params.discountType || null,
                discount_value: params.discountValue ?? null,
                priority,
                is_active: true,
            })
            .select("*")
            .single();

        if (error) {
            console.error("Error creating rule:", error);
            return { success: false, error: error.message };
        }

        return { success: true, data: mapRuleFromDb(data) };
    } catch (error: any) {
        console.error("Error in createRule:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Update an existing configuration rule.
 */
export async function updateRule(
    ruleId: string,
    params: UpdateRuleParams
): Promise<{ success: boolean; data?: ConfigurationRule; error?: string }> {
    try {
        const supabase = await createClient();

        // Auth check
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // Build update object (only include provided fields)
        const updateData: any = {
            updated_at: new Date().toISOString(),
        };

        if (params.ruleType !== undefined) updateData.rule_type = params.ruleType;
        if (params.name !== undefined) updateData.name = params.name;
        if (params.description !== undefined) updateData.description = params.description || null;
        if (params.errorMessage !== undefined) updateData.error_message = params.errorMessage || null;
        if (params.ifOptionId !== undefined) updateData.if_option_id = params.ifOptionId || null;
        if (params.ifGroupId !== undefined) updateData.if_group_id = params.ifGroupId || null;
        if (params.thenOptionId !== undefined) updateData.then_option_id = params.thenOptionId || null;
        if (params.thenGroupId !== undefined) updateData.then_group_id = params.thenGroupId || null;
        if (params.allowedOptions !== undefined) {
            const allowedOptionsValidation = allowedOptionsSchema.safeParse(params.allowedOptions);
            if (!allowedOptionsValidation.success) {
                return { success: false, error: `Invalid allowed_options: ${allowedOptionsValidation.error.issues[0].message}` };
            }
            updateData.allowed_options = params.allowedOptions;
        }
        if (params.quantityMin !== undefined) updateData.quantity_min = params.quantityMin;
        if (params.quantityMax !== undefined) updateData.quantity_max = params.quantityMax;
        if (params.discountType !== undefined) updateData.discount_type = params.discountType;
        if (params.discountValue !== undefined) updateData.discount_value = params.discountValue;
        if (params.priority !== undefined) updateData.priority = params.priority;
        if (params.isActive !== undefined) updateData.is_active = params.isActive;

        const { data, error } = await supabase
            .from("configuration_rules")
            .update(updateData)
            .eq("id", ruleId)
            .select("*")
            .single();

        if (error) {
            console.error("Error updating rule:", error);
            return { success: false, error: error.message };
        }

        return { success: true, data: mapRuleFromDb(data) };
    } catch (error: any) {
        console.error("Error in updateRule:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a configuration rule.
 */
export async function deleteRule(
    ruleId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        // Auth check
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        const { error } = await supabase
            .from("configuration_rules")
            .delete()
            .eq("id", ruleId);

        if (error) {
            console.error("Error deleting rule:", error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error in deleteRule:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Reorder rules by updating their priority.
 */
export async function reorderRules(
    templateId: string,
    ruleIds: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        // Auth check
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // Update each rule's priority based on its position
        const updates = ruleIds.map((id, index) =>
            supabase
                .from("configuration_rules")
                .update({ priority: (index + 1) * 10 })
                .eq("id", id)
                .eq("template_id", templateId)
        );

        const results = await Promise.all(updates);
        const failed = results.find((r) => r.error);

        if (failed?.error) {
            return { success: false, error: failed.error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error in reorderRules:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Toggle a rule's active status.
 */
export async function toggleRuleActive(
    ruleId: string
): Promise<{ success: boolean; data?: { isActive: boolean }; error?: string }> {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // Get current status
        const { data: rule, error: fetchError } = await supabase
            .from("configuration_rules")
            .select("is_active")
            .eq("id", ruleId)
            .single();

        if (fetchError || !rule) {
            return { success: false, error: "Rule not found" };
        }

        const newStatus = !rule.is_active;

        const { error } = await supabase
            .from("configuration_rules")
            .update({ is_active: newStatus, updated_at: new Date().toISOString() })
            .eq("id", ruleId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, data: { isActive: newStatus } };
    } catch (error: any) {
        console.error("Error in toggleRuleActive:", error);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// HELPERS
// ============================================================================

function mapRuleFromDb(r: any): ConfigurationRule {
    return {
        id: r.id,
        templateId: r.template_id,
        ruleType: r.rule_type,
        name: r.name,
        description: r.description,
        errorMessage: r.error_message,
        ifOptionId: r.if_option_id,
        ifGroupId: r.if_group_id,
        ifProductId: r.if_product_id,
        thenOptionId: r.then_option_id,
        thenGroupId: r.then_group_id,
        thenProductId: r.then_product_id,
        allowedOptions: r.allowed_options,
        quantityMin: r.quantity_min,
        quantityMax: r.quantity_max,
        discountType: r.discount_type,
        discountValue: r.discount_value ? parseFloat(r.discount_value) : null,
        priority: r.priority,
        isActive: r.is_active,
    };
}
