"use server";

// TEMPORARY: Using admin client
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { validateConfiguration } from "./validation-actions";
import { calculatePrice, type PriceCalculation } from "./pricing-actions";

// ============================================================================
// TYPES
// ============================================================================

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
    priceBreakdown: any;
    notes: string | null;
    inventoryReservationStatus: "none" | "soft" | "hard";
    inventoryReservationId: string | null;
    createdAt: string;
    updatedAt: string;
}

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
        const supabase = createAdminClient();
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

        // 2. Calculate price
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
            // Anonymous - use session ID from cookie or generate
            configData.session_id = "anon-" + Date.now();
        }

        if (params.generateShareToken) {
            // Generate share token
            const token = Buffer.from(
                Math.random().toString(36).substring(2, 15) +
                Math.random().toString(36).substring(2, 15)
            ).toString("base64").substring(0, 12);
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
        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from("configurations")
            .select("*")
            .eq("id", configurationId)
            .single();

        if (error || !data) {
            return { success: false, error: "Configuration not found" };
        }

        // Recalculate price (prices may have changed)
        const priceResult = await calculatePrice({
            templateId: data.template_id,
            selectedOptions: data.selected_options,
            quantity: data.quantity,
        });

        if (priceResult.success && priceResult.data) {
            // Update stored price if different
            const newPrice = priceResult.data.total;
            if (Math.abs(newPrice - parseFloat(data.total_price)) > 0.01) {
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
        const supabase = createAdminClient();

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
        const supabase = createAdminClient();

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
        const supabase = createAdminClient();

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
        const supabase = createAdminClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "Authentication required" };
        }

        const page = params?.page || 1;
        const pageSize = Math.min(params?.pageSize || 20, 100);

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

// ============================================================================
// HELPERS
// ============================================================================

function mapConfigurationFromDb(data: any): Configuration {
    return {
        id: data.id,
        templateId: data.template_id,
        userId: data.user_id,
        sessionId: data.session_id,
        selectedOptions: data.selected_options,
        basePrice: parseFloat(data.base_price || "0"),
        optionsTotal: parseFloat(data.options_total || "0"),
        discountAmount: parseFloat(data.discount_amount || "0"),
        totalPrice: parseFloat(data.total_price || "0"),
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
