"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { validateConfiguration } from "./validation-actions";
import { calculatePrice, type PriceCalculation } from "./pricing-actions";

// ============================================================================
// TYPES
// ============================================================================

export interface PriceBreakdownItem {
    optionId: string;
    optionName: string;
    modifierType: "add" | "multiply" | "percent";
    modifierAmount: number;
}

export interface Configuration {
    id: string;
    templateId: string;
    userId: string | null;
    sessionId: string | null;
    selectedOptions: Record<string, string | string[]>;
    basePrice: number;
    optionsTotal: number;
    discountAmount: number;
    totalPrice: number;
    quantity: number;
    status: "draft" | "completed" | "quoted" | "ordered" | "expired";
    shareToken: string | null;
    priceBreakdown: PriceBreakdownItem[];
    notes: string | null;
    inventoryReservationStatus: "none" | "soft" | "hard";
    inventoryReservationId: string | null;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const PRICE_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const PRICE_DIFFERENCE_THRESHOLD = 0.01; // $0.01

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Save a new configuration or update existing draft.
 * Automatically validates and calculates price before saving.
 */
export async function saveConfiguration(params: {
    templateId: string;
    selectedOptions: Record<string, string | string[]>;
    quantity?: number;
    notes?: string;
    generateShareToken?: boolean;
    configurationId?: string; // If updating existing
}): Promise<{
    success: boolean;
    data?: Configuration;
    error?: string;
}> {
    try {

        const supabase = await createClient();
        const quantity = params.quantity || 1;

        // 1. Validate configuration
        const validationResult = await validateConfiguration({
            templateId: params.templateId,
            selectedOptions: params.selectedOptions,
        });

        if (!validationResult.success || !validationResult.data?.isValid) {
            return {
                success: false,
                error: "Configuration has validation errors",
            };
        }

        // 2. Validate tenant access (defense in depth beyond RLS)
        const { data: template, error: templateError } = await supabase
            .from('cpq_templates')
            .select('tenant_id')
            .eq('id', params.templateId)
            .single();

        if (templateError || !template) {
            return { success: false, error: 'Template not found' };
        }

        // Verify user's tenant matches template's tenant (admins bypass this)
        if (user) {
            const userTenantId = user.app_metadata?.tenant_id;
            const isAdmin = user.app_metadata?.app_role === 'admin' || user.app_metadata?.app_role === 'super_admin';

            if (!isAdmin && template.tenant_id !== userTenantId) {
                return { success: false, error: 'Template not found' };
            }
        }

        // 3. Calculate price
        const priceResult = await calculatePrice({
            templateId: params.templateId,
            selectedOptions: params.selectedOptions,
            quantity,
        });

        if (!priceResult.success || !priceResult.data) {
            return { success: false, error: "Failed to calculate price" };
        }

        const pricing = priceResult.data;

        // 3. Get current user or session
        const {
            data: { user },
        } = await supabase.auth.getUser();

        // 4. Prepare configuration data
        const configData: any = {
            template_id: params.templateId,
            selected_options: params.selectedOptions,
            base_price: pricing.basePrice,
            options_total: pricing.optionsTotal,
            discount_amount: pricing.discountAmount,
            total_price: pricing.total,
            quantity,
            price_breakdown: pricing.breakdown,
            notes: params.notes || null,
            status: "draft",
            inventory_reservation_status: "none",
        };

        if (user) {
            configData.user_id = user.id;
        } else {
            // Anonymous - use cryptographically secure session ID
            const { randomUUID } = await import('crypto');
            configData.session_id = `anon-${randomUUID()}`;
        }

        if (params.generateShareToken) {
            // Generate cryptographically secure share token
            const { randomBytes } = await import('crypto');
            const token = randomBytes(9).toString('base64url'); // 12 chars
            configData.share_token = token;
        }

        // 5. Insert or update
        let result;
        if (params.configurationId) {
            // Update existing draft
            const { data, error } = await supabase
                .from("configurations")
                .update(configData)
                .eq("id", params.configurationId)
                .eq("status", "draft") // Only allow updating drafts
                .select()
                .single();

            if (error) {
                return { success: false, error: error.message };
            }
            result = data;
        } else {
            // Create new
            const { data, error } = await supabase
                .from("configurations")
                .insert(configData)
                .select()
                .single();

            if (error) {
                return { success: false, error: error.message };
            }
            result = data;
        }

        return {
            success: true,
            data: mapConfigurationFromDb(result),
        };
    } catch (error: any) {
        console.error("Error in saveConfiguration:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Load a saved configuration by ID.
 * Recalculates price on load to ensure accuracy.
 */
export async function getConfiguration(configurationId: string): Promise<{
    success: boolean;
    data?: Configuration;
    error?: string;
}> {
    try {

        const supabase = await createClient();

        const { data, error } = await supabase
            .from("configurations")
            .select("*")
            .eq("id", configurationId)
            .single();

        if (error || !data) {
            return { success: false, error: "Configuration not found" };
        }

        // Recalculate price only if data is stale (>24 hours old)
        const configAge = Date.now() - new Date(data.updated_at).getTime();

        if (configAge > PRICE_STALE_THRESHOLD_MS) {
            // Stale data - recalculate price (prices may have changed)
            const priceResult = await calculatePrice({
                templateId: data.template_id,
                selectedOptions: data.selected_options,
                quantity: data.quantity,
            });

            if (priceResult.success && priceResult.data) {
                // Update stored price if different
                const newPrice = priceResult.data.total;
                if (Math.abs(newPrice - parseFloat(data.total_price)) > PRICE_DIFFERENCE_THRESHOLD) {
                    await supabase
                        .from("configurations")
                        .update({
                            base_price: priceResult.data.basePrice,
                            options_total: priceResult.data.optionsTotal,
                            discount_amount: priceResult.data.discountAmount,
                            total_price: priceResult.data.total,
                            price_breakdown: priceResult.data.breakdown,
                        })
                        .eq("id", configurationId);

                    data.total_price = newPrice.toString();
                    data.base_price = priceResult.data.basePrice.toString();
                    data.options_total = priceResult.data.optionsTotal.toString();
                    data.discount_amount = priceResult.data.discountAmount.toString();
                    data.price_breakdown = priceResult.data.breakdown;
                }
            }
        }

        return {
            success: true,
            data: mapConfigurationFromDb(data),
        };
    } catch (error: any) {
        console.error("Error in getConfiguration:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Load configuration by share token (public, no auth required).
 */
export async function getConfigurationByShareToken(shareToken: string): Promise<{
    success: boolean;
    data?: Configuration & { templateName?: string };
    error?: string;
}> {
    try {

        const supabase = await createClient();

        const { data, error } = await supabase
            .from("configurations")
            .select(`
        *,
        product_templates(name)
      `)
            .eq("share_token", shareToken)
            .single();

        if (error || !data) {
            return { success: false, error: "Shared configuration not found" };
        }

        const config = mapConfigurationFromDb(data);

        return {
            success: true,
            data: {
                ...config,
                templateName: data.product_templates?.name,
            },
        };
    } catch (error: any) {
        console.error("Error in getConfigurationByShareToken:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Update configuration with partial changes (PATCH).
 * Merges with existing selections, re-validates, and re-calculates.
 */
export async function updateConfiguration(
    configurationId: string,
    patch: {
        selectedOptions?: Record<string, string | string[] | null>;
        quantity?: number;
        notes?: string;
    }
): Promise<{
    success: boolean;
    data?: Configuration;
    error?: string;
}> {
    try {

        const supabase = await createClient();

        // 1. Get existing configuration
        const { data: existing, error: fetchError } = await supabase
            .from("configurations")
            .select("*")
            .eq("id", configurationId)
            .eq("status", "draft")
            .single();

        if (fetchError || !existing) {
            return { success: false, error: "Configuration not found or not in draft status" };
        }

        // 2. Merge selections
        const mergedSelections = { ...existing.selected_options };
        if (patch.selectedOptions) {
            for (const [groupId, value] of Object.entries(patch.selectedOptions)) {
                if (value === null) {
                    delete mergedSelections[groupId];
                } else {
                    mergedSelections[groupId] = value;
                }
            }
        }

        // 3. Save with merged data
        return await saveConfiguration({
            templateId: existing.template_id,
            selectedOptions: mergedSelections,
            quantity: patch.quantity !== undefined ? patch.quantity : existing.quantity,
            notes: patch.notes !== undefined ? patch.notes : existing.notes,
            configurationId,
        });
    } catch (error: any) {
        console.error("Error in updateConfiguration:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Mark configuration as completed.
 * Validates all required groups before transition.
 */
export async function completeConfiguration(configurationId: string): Promise<{
    success: boolean;
    data?: Configuration;
    error?: string;
}> {
    try {

        const supabase = await createClient();

        // 1. Get configuration
        const { data: config, error: fetchError } = await supabase
            .from("configurations")
            .select("*")
            .eq("id", configurationId)
            .single();

        if (fetchError || !config) {
            return { success: false, error: "Configuration not found" };
        }

        if (config.status !== "draft") {
            return { success: false, error: "Only draft configurations can be completed" };
        }

        // 2. Validate
        const validationResult = await validateConfiguration({
            templateId: config.template_id,
            selectedOptions: config.selected_options,
        });

        if (!validationResult.success || !validationResult.data?.isValid) {
            return {
                success: false,
                error: "Configuration is invalid. Please fix all errors before completing.",
            };
        }

        // 3. Update status
        const { data, error } = await supabase
            .from("configurations")
            .update({ status: "completed" })
            .eq("id", configurationId)
            .select()
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            data: mapConfigurationFromDb(data),
        };
    } catch (error: any) {
        console.error("Error in completeConfiguration:", error);
        return { success: false, error: error.message };
    }
}

/**
 * List configurations for current user.
 */
export async function getConfigurations(params?: {
    status?: string;
    templateId?: string;
    page?: number;
    pageSize?: number;
}): Promise<{
    success: boolean;
    data?: Configuration[];
    meta?: { page: number; pageSize: number; total: number };
    error?: string;
}> {
    try {

        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        const page = params?.page || 1;
        const pageSize = Math.min(params?.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

        let query = supabase
            .from("configurations")
            .select("*", { count: "exact" })
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false });

        if (params?.status) {
            query = query.eq("status", params.status);
        }

        if (params?.templateId) {
            query = query.eq("template_id", params.templateId);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            data: (data || []).map(mapConfigurationFromDb),
            meta: { page, pageSize, total: count || 0 },
        };
    } catch (error: any) {
        console.error("Error in getConfigurations:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a configuration (only drafts can be deleted by non-admins).
 */
export async function deleteConfiguration(configurationId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // Get configuration first to check permissions
        const { data: config, error: fetchError } = await supabase
            .from("configurations")
            .select("*")
            .eq("id", configurationId)
            .single();

        if (fetchError || !config) {
            return { success: false, error: "Configuration not found" };
        }

        // Only allow deleting own configurations (unless admin)
        const isAdmin = user.app_metadata?.app_role === 'admin' || user.app_metadata?.app_role === 'super_admin';

        if (!isAdmin && config.user_id !== user.id) {
            return { success: false, error: "Not authorized to delete this configuration" };
        }

        // Only allow deleting drafts (unless admin)
        if (!isAdmin && config.status !== "draft") {
            return { success: false, error: "Only draft configurations can be deleted" };
        }

        // Delete the configuration
        const { error: deleteError } = await supabase
            .from("configurations")
            .delete()
            .eq("id", configurationId);

        if (deleteError) {
            return { success: false, error: deleteError.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error in deleteConfiguration:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Duplicate a configuration as a new draft.
 */
export async function duplicateConfiguration(configurationId: string): Promise<{
    success: boolean;
    data?: Configuration;
    error?: string;
}> {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        // Get existing configuration
        const { data: existing, error: fetchError } = await supabase
            .from("configurations")
            .select("*")
            .eq("id", configurationId)
            .single();

        if (fetchError || !existing) {
            return { success: false, error: "Configuration not found" };
        }

        // Create new configuration with same data but as draft
        const newConfigData = {
            template_id: existing.template_id,
            user_id: user.id,
            selected_options: existing.selected_options,
            base_price: existing.base_price,
            options_total: existing.options_total,
            discount_amount: existing.discount_amount,
            total_price: existing.total_price,
            quantity: existing.quantity,
            price_breakdown: existing.price_breakdown,
            notes: existing.notes ? `Copy of: ${existing.notes}` : "Duplicated configuration",
            status: "draft",
            inventory_reservation_status: "none",
        };

        const { data, error } = await supabase
            .from("configurations")
            .insert(newConfigData)
            .select()
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            data: mapConfigurationFromDb(data),
        };
    } catch (error: any) {
        console.error("Error in duplicateConfiguration:", error);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// HELPERS
// ============================================================================

interface ConfigurationDbRow {
    id: string;
    template_id: string;
    user_id: string | null;
    session_id: string | null;
    selected_options: Record<string, string | string[]>;
    base_price: string;
    options_total: string;
    discount_amount: string;
    total_price: string;
    quantity: number;
    status: string;
    share_token: string | null;
    price_breakdown: PriceBreakdownItem[];
    notes: string | null;
    inventory_reservation_status: string;
    inventory_reservation_id: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Helper to round currency values to 2 decimal places
 * Prevents floating point precision errors
 */
function roundCurrency(value: string | number): number {
    return Math.round(parseFloat(String(value || "0")) * 100) / 100;
}

function mapConfigurationFromDb(data: ConfigurationDbRow): Configuration {
    return {
        id: data.id,
        templateId: data.template_id,
        userId: data.user_id,
        sessionId: data.session_id,
        selectedOptions: data.selected_options,
        basePrice: roundCurrency(data.base_price),
        optionsTotal: roundCurrency(data.options_total),
        discountAmount: roundCurrency(data.discount_amount),
        totalPrice: roundCurrency(data.total_price),
        quantity: data.quantity,
        status: data.status,
        shareToken: data.share_token,
        priceBreakdown: data.price_breakdown,
        notes: data.notes,
        inventoryReservationStatus: data.inventory_reservation_status,
        inventoryReservationId: data.inventory_reservation_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}
