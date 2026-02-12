"use server";

// TEMPORARY: Using admin client
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { completeConfiguration } from "./configuration-actions";

// ============================================================================
// TYPES
// ============================================================================

export interface ConfiguredProduct {
    id: string;
    configurationId: string;
    generatedSku: string;
    generatedName: string;
    generatedDescription: string | null;
    finalPrice: number;
    bomHeaderId: string | null;
    productId: string | null;
    bomExplosionMode: "current" | "current_and_future" | "all";
    configurationSnapshot: any;
    createdAt: string;
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Convert a completed configuration into a quote line item.
 * Creates configured_product record and adds to quote.
 * 
 * Phase 1: Skip BOM generation (will be added in Phase 2)
 */
export async function addConfiguredProductToQuote(params: {
    configurationId: string;
    quoteId: string;
    generateBom?: boolean;
    bomExplosionMode?: "current" | "current_and_future" | "all";
}): Promise<{
    success: boolean;
    data?: {
        configuredProduct: ConfiguredProduct;
        quoteItemId: string;
        bomHeaderId: string | null;
    };
    error?: string;
}> {
    try {
        const supabase = createAdminClient();

        // 1. Get configuration
        const { data: config, error: configError } = await supabase
            .from("configurations")
            .select(`
        *,
        product_templates(name, description)
      `)
            .eq("id", params.configurationId)
            .single();

        if (configError || !config) {
            return { success: false, error: "Configuration not found" };
        }

        // 2. Ensure configuration is completed
        if (config.status === "draft") {
            const completeResult = await completeConfiguration(params.configurationId);
            if (!completeResult.success) {
                return { success: false, error: completeResult.error };
            }
        }

        if (!["completed", "quoted"].includes(config.status)) {
            return {
                success: false,
                error: `Configuration must be completed before adding to quote (current status: ${config.status})`,
            };
        }

        // 3. Verify quote exists
        const { data: quote, error: quoteError } = await supabase
            .from("quotes")
            .select("id, tenant_id")
            .eq("id", params.quoteId)
            .single();

        if (quoteError || !quote) {
            return { success: false, error: "Quote not found" };
        }

        // 4. Generate unique SKU
        const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
        const hash = Buffer.from(JSON.stringify(config.selected_options))
            .toString("base64")
            .substring(0, 8)
            .replace(/[^a-zA-Z0-9]/g, "");
        const generatedSku = `CPQ-${config.product_templates.name
            .replace(/[^a-zA-Z0-9]/g, "")
            .substring(0, 10)
            .toUpperCase()}-${hash}-${timestamp}`;

        // 5. Generate name and description
        const selectedOptionsText = Object.entries(config.selected_options)
            .map(([groupId, optionId]) => {
                // This is simplified - in production, fetch actual option names
                return optionId;
            })
            .join(", ");

        const generatedName = `${config.product_templates.name} (Configured)`;
        const generatedDescription = `${config.product_templates.description || ""}\n\nConfiguration: ${selectedOptionsText}`;

        // 6. Create configured_products record
        const configuredProductData = {
            tenant_id: config.tenant_id,
            configuration_id: config.id,
            generated_sku: generatedSku,
            generated_name: generatedName,
            generated_description: generatedDescription,
            final_price: config.total_price,
            bom_explosion_mode: params.bomExplosionMode || "current",
            configuration_snapshot: {
                templateId: config.template_id,
                templateName: config.product_templates.name,
                selectedOptions: config.selected_options,
                basePrice: config.base_price,
                optionsTotal: config.options_total,
                discountAmount: config.discount_amount,
                totalPrice: config.total_price,
                quantity: config.quantity,
                priceBreakdown: config.price_breakdown,
            },
        };

        const { data: configuredProduct, error: cpError } = await supabase
            .from("configured_products")
            .insert(configuredProductData)
            .select()
            .single();

        if (cpError) {
            console.error("Error creating configured product:", cpError);
            return { success: false, error: cpError.message };
        }

        // 7. Add to quote as line item
        // Find highest line number
        const { data: existingItems } = await supabase
            .from("quote_items")
            .select("line_number")
            .eq("quote_id", params.quoteId)
            .order("line_number", { ascending: false })
            .limit(1);

        const nextLineNumber = existingItems && existingItems.length > 0
            ? existingItems[0].line_number + 1
            : 1;

        const quoteItemData = {
            tenant_id: quote.tenant_id,
            quote_id: params.quoteId,
            line_number: nextLineNumber,
            item_type: "configured_product" as const,
            description: generatedName,
            quantity: config.quantity,
            unit_price: parseFloat(config.total_price) / config.quantity,
            discount_percent: 0,
            tax_rate: 0,
            notes: `Configured product - Configuration ID: ${config.id}`,
            metadata: {
                configurationId: config.id,
                configuredProductId: configuredProduct.id,
                generatedSku: generatedSku,
            },
        };

        const { data: quoteItem, error: qiError } = await supabase
            .from("quote_items")
            .insert(quoteItemData)
            .select()
            .single();

        if (qiError) {
            console.error("Error creating quote item:", qiError);
            // Rollback configured_product?
            return { success: false, error: qiError.message };
        }

        // 8. Update configuration status to 'quoted'
        // Create SOFT inventory reservation (advisory, doesn't block stock)
        await supabase
            .from("configurations")
            .update({
                status: "quoted",
                inventory_reservation_status: "soft",
            })
            .eq("id", params.configurationId);

        // 9. Phase 1: Skip BOM generation (implement in Phase 2)
        // TODO Phase 2: Generate BOM if params.generateBom === true

        return {
            success: true,
            data: {
                configuredProduct: {
                    id: configuredProduct.id,
                    configurationId: configuredProduct.configuration_id,
                    generatedSku: configuredProduct.generated_sku,
                    generatedName: configuredProduct.generated_name,
                    generatedDescription: configuredProduct.generated_description,
                    finalPrice: parseFloat(configuredProduct.final_price),
                    bomHeaderId: configuredProduct.bom_header_id,
                    productId: configuredProduct.product_id,
                    bomExplosionMode: configuredProduct.bom_explosion_mode,
                    configurationSnapshot: configuredProduct.configuration_snapshot,
                    createdAt: configuredProduct.created_at,
                },
                quoteItemId: quoteItem.id,
                bomHeaderId: null, // Phase 2
            },
        };
    } catch (error: any) {
        console.error("Error in addConfiguredProductToQuote:", error);
        return { success: false, error: error.message };
    }
}
