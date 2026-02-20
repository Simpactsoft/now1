// src/app/actions/cpq/bom-generation-actions.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function generateBomForConfiguration(params: {
    configurationId: string;
    quoteItemId: string;
    tenantId: string;
}) {
    const adminClient = createAdminClient();

    // 1. Fetch configuration details and template
    const { data: config, error: configError } = await adminClient
        .from("configurations")
        .select(`
            *,
            product_templates(name, description, category_id)
        `)
        .eq("id", params.configurationId)
        .single();

    if (configError || !config) {
        console.error("Configuration not found:", configError);
        return { success: false, error: "Configuration not found" };
    }

    // Generate uniqueness keys
    const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const hash = Buffer.from(JSON.stringify(config.selected_options))
        .toString("base64")
        .substring(0, 8)
        .replace(/[^a-zA-Z0-9]/g, "");
    const generatedSku = `CPQ-${config.product_templates.name
        .replace(/[^a-zA-Z0-9]/g, "")
        .substring(0, 10)
        .toUpperCase()}-${hash}-${timestamp}`;

    // Check if configured_product already exists for this config
    const { data: existingCp } = await adminClient
        .from("configured_products")
        .select("id, bom_header_id, product_id")
        .eq("configuration_id", params.configurationId)
        .single();

    if (existingCp && existingCp.bom_header_id) {
        // Already generated BOM for this configuration, just return
        return { success: true, alreadyExists: true, productId: existingCp.product_id || null };
    }

    const generatedName = `${config.product_templates.name} (Configured)`;
    const generatedDescription = `Configuration: ${Object.values(config.selected_options).join(', ')}`;

    // 2. Create the wrapper Product
    const { data: newProduct, error: productError } = await adminClient
        .from("products")
        .insert({
            tenant_id: params.tenantId,
            sku: generatedSku,
            name: generatedName,
            description: generatedDescription,
            list_price: config.total_price,
            cost_price: 0, // In practice, rollup from components
            category_id: config.product_templates.category_id,
            track_inventory: false // Built to order
        })
        .select()
        .single();

    if (productError) {
        console.error("Error creating BOM product:", productError);
        return { success: false, error: productError.message };
    }

    // 3. Create BOM Header
    const { data: bomHeader, error: bomHeaderError } = await adminClient
        .from("bom_headers")
        .insert({
            tenant_id: params.tenantId,
            product_id: newProduct.id,
            version: "1.0",
            status: "ACTIVE",
            description: "Auto-generated from CPQ Configuration"
        })
        .select()
        .single();

    if (bomHeaderError) {
        console.error("Error creating BOM header:", bomHeaderError);
        return { success: false, error: bomHeaderError.message };
    }

    // 4. Create/Update Configured Product mapping
    if (existingCp) {
        await adminClient
            .from("configured_products")
            .update({
                product_id: newProduct.id,
                bom_header_id: bomHeader.id
            })
            .eq("id", existingCp.id);
    } else {
        await adminClient
            .from("configured_products")
            .insert({
                tenant_id: params.tenantId,
                configuration_id: config.id,
                generated_sku: generatedSku,
                generated_name: generatedName,
                generated_description: generatedDescription,
                final_price: config.total_price,
                bom_header_id: bomHeader.id,
                product_id: newProduct.id,
                bom_explosion_mode: "current",
                configuration_snapshot: {
                    templateId: config.template_id,
                    selectedOptions: config.selected_options,
                    basePrice: config.base_price,
                    optionsTotal: config.options_total,
                    discountAmount: config.discount_amount,
                    totalPrice: config.total_price,
                    quantity: config.quantity
                }
            });
    }

    // 5. Generate BOM Items
    const bomItemsData = [];
    let sequence = 10;

    for (const [groupId, optionVal] of Object.entries(config.selected_options)) {
        const optionIds = Array.isArray(optionVal) ? optionVal : [optionVal];

        for (const optId of optionIds as string[]) {
            // Try to resolve to a catalog product_id
            const { data: optionDetails } = await adminClient
                .from("options")
                .select("product_id")
                .eq("id", optId)
                .single();

            let componentProductId = null;
            if (optionDetails && optionDetails.product_id) {
                componentProductId = optionDetails.product_id;
            } else {
                // Check if it's already a product (category sourcing mode)
                const { data: directProduct } = await adminClient
                    .from("products")
                    .select("id")
                    .eq("id", optId)
                    .single();
                if (directProduct) {
                    componentProductId = directProduct.id;
                }
            }

            if (componentProductId) {
                bomItemsData.push({
                    tenant_id: params.tenantId,
                    bom_header_id: bomHeader.id,
                    component_product_id: componentProductId,
                    sequence: sequence,
                    quantity: 1 * config.quantity,
                    unit: 'EA'
                });
                sequence += 10;
            }
        }
    }

    if (bomItemsData.length > 0) {
        await adminClient.from("bom_items").insert(bomItemsData);
    }

    return { success: true, bomHeaderId: bomHeader.id, productId: newProduct.id };
}
