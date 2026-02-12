"use server";

// TEMPORARY: Using admin client for testing without auth
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";

// ============================================================================
// TYPES
// ============================================================================

export interface PriceBreakdownItem {
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
    modifierType: "add" | "multiply" | "replace";
    modifierAmount: number;
    lineTotal: number;
}

export interface DiscountDetail {
    name: string;
    type: "percentage" | "fixed_amount";
    value: number;
    amount: number;
}

export interface PriceCalculation {
    basePrice: number;
    optionsTotal: number;
    subtotal: number;
    discounts: DiscountDetail[];
    discountAmount: number;
    total: number;
    perUnitPrice: number;
    quantity: number;
    breakdown: PriceBreakdownItem[];
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Calculate the AUTHORITATIVE price for a configuration.
 * This is the source of truth for quotes and orders.
 * 
 * CRITICAL: Operation order MUST match client-side calculation:
 * Formula: T = (B + ΣO_add) × ΠM_mult – D
 * 
 * Frontend should also calculate for instant feedback, but this endpoint
 * is authoritative for actual pricing.
 */
export async function calculatePrice(params: {
    templateId: string;
    selectedOptions: Record<string, string | string[]>;
    quantity?: number;
}): Promise<{
    success: boolean;
    data?: PriceCalculation;
    error?: string;
}> {
    try {
        const supabase = createAdminClient();
        const quantity = params.quantity || 1;

        // 1. Get template base price
        const { data: templateData, error: templateError } = await supabase
            .from("product_templates")
            .select("base_price")
            .eq("id", params.templateId)
            .single();

        if (templateError || !templateData) {
            return { success: false, error: "Template not found" };
        }

        let basePrice = parseFloat(templateData.base_price || "0");
        let additiveTotal = 0;
        let multiplicativeFactor = 1;
        const breakdown: PriceBreakdownItem[] = [];

        // 2. Get all option groups to resolve option names
        const { data: groupsData } = await supabase
            .from("option_groups")
            .select("id, name, source_type")
            .eq("template_id", params.templateId);

        const groupMap = new Map(
            (groupsData || []).map((g: any) => [g.id, { name: g.name, sourceType: g.source_type }])
        );

        // 3. PERFORMANCE FIX: Extract all selected option IDs first
        const allOptionIds: string[] = [];
        for (const optionValue of Object.values(params.selectedOptions)) {
            const ids = Array.isArray(optionValue) ? optionValue : [optionValue];
            allOptionIds.push(...ids);
        }

        // 4. Fetch ALL manual options in ONE query (instead of N queries in loop)
        const { data: optionsData } = await supabase
            .from("options")
            .select("id, name, price_modifier_type, price_modifier_amount")
            .in("id", allOptionIds);

        // 5. Fetch ALL category-driven products in ONE query
        const { data: productsData } = await supabase
            .from("products")
            .select("id, name, list_price")
            .in("id", allOptionIds);

        // 6. Build lookup maps for O(1) access
        const optionMap = new Map(
            (optionsData || []).map((o: any) => [o.id, o])
        );
        const productMap = new Map(
            (productsData || []).map((p: any) => [p.id, p])
        );

        // 7. Process each selection WITHOUT database queries
        for (const [groupId, optionValue] of Object.entries(params.selectedOptions)) {
            const optionIds = Array.isArray(optionValue) ? optionValue : [optionValue];
            const group = groupMap.get(groupId);

            for (const optionId of optionIds) {
                // Get option details from pre-fetched maps
                let optionData: any = null;

                if (group?.sourceType === "manual") {
                    // Look up in manual options map
                    optionData = optionMap.get(optionId);
                } else {
                    // Look up in products map
                    const product = productMap.get(optionId);
                    if (product) {
                        optionData = {
                            name: product.name,
                            price_modifier_type: "add",
                            price_modifier_amount: product.list_price || 0,
                        };
                    }
                }

                if (!optionData) continue;

                const modifierType = optionData.price_modifier_type;
                const modifierAmount = parseFloat(optionData.price_modifier_amount || "0");

                // ─── PRICING OPERATION ORDER (CRITICAL) ───
                // Collect modifiers by type - DO NOT apply yet!
                switch (modifierType) {
                    case "add":
                        additiveTotal += modifierAmount;
                        break;
                    case "multiply":
                        multiplicativeFactor *= modifierAmount;
                        break;
                    case "replace":
                        basePrice = modifierAmount;
                        break;
                }

                breakdown.push({
                    groupId,
                    groupName: group?.name || "",
                    optionId,
                    optionName: optionData.name,
                    modifierType,
                    modifierAmount,
                    lineTotal: modifierType === "add" ? modifierAmount : 0,
                });
            }
        }

        // ─── APPLY OPERATIONS IN CORRECT ORDER ───
        // Step 1: Base + all additive modifiers
        const subtotalBeforeMultiply = basePrice + additiveTotal;

        // Step 2: Apply multiplicative modifiers
        const subtotalAfterMultiply = subtotalBeforeMultiply * multiplicativeFactor;

        // Step 3: Apply quantity-based discounts (price_tier rules)
        const { data: rulesData } = await supabase
            .from("configuration_rules")
            .select("*")
            .eq("template_id", params.templateId)
            .eq("rule_type", "price_tier")
            .eq("is_active", true)
            .lte("quantity_min", quantity)
            .order("quantity_min", { ascending: false })
            .limit(1);

        const discounts: DiscountDetail[] = [];
        let discountAmount = 0;

        if (rulesData && rulesData.length > 0) {
            const rule = rulesData[0];
            if (rule.discount_type === "percentage" && rule.discount_value) {
                discountAmount = subtotalAfterMultiply * (parseFloat(rule.discount_value) / 100);
                discounts.push({
                    name: rule.name,
                    type: "percentage",
                    value: parseFloat(rule.discount_value),
                    amount: discountAmount,
                });
            } else if (rule.discount_type === "fixed_amount" && rule.discount_value) {
                discountAmount = parseFloat(rule.discount_value);
                discounts.push({
                    name: rule.name,
                    type: "fixed_amount",
                    value: parseFloat(rule.discount_value),
                    amount: discountAmount,
                });
            }
        }

        // Final calculation
        const perUnitPrice = subtotalAfterMultiply - discountAmount;
        const total = perUnitPrice * quantity;

        return {
            success: true,
            data: {
                basePrice,
                optionsTotal: additiveTotal,
                subtotal: subtotalAfterMultiply,
                discounts,
                discountAmount,
                total,
                perUnitPrice,
                quantity,
                breakdown,
            },
        };
    } catch (error: any) {
        console.error("Error in calculatePrice:", error);
        return { success: false, error: error.message };
    }
}
