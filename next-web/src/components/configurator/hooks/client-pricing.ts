/**
 * Client-side price calculation.
 * 
 * CRITICAL: Operation order MUST match server-side exactly:
 * Formula: T = (B + ΣO_add) × ΠM_mult – D
 * 
 * Used for instant feedback only. Server calculation is authoritative.
 */

import type { OptionGroup, ConfigurationRule } from "@/app/actions/cpq/template-actions";

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

/**
 * Calculate price client-side for instant UI updates.
 * MUST use the same operation order as server!
 */
export function calculatePriceClientSide(
    basePrice: number,
    selections: Record<string, string | string[]>,
    optionGroups: OptionGroup[],
    quantity: number = 1,
    rules: ConfigurationRule[] = []
): PriceCalculation {
    // ─── PRICING OPERATION ORDER (CRITICAL) ───
    // Formula: T = (B + ΣO_add) × ΠM_mult – D
    // Step 1: Sum all additive modifiers
    // Step 2: Apply multiplicative modifiers to (base + additives)
    // Step 3: Subtract discounts

    let additiveTotal = 0;
    let multiplicativeFactor = 1;
    let effectiveBase = basePrice;
    const breakdown: PriceBreakdownItem[] = [];

    // Build option lookup
    const optionMap = new Map<string, any>();
    const groupMap = new Map<string, OptionGroup>();
    for (const group of optionGroups) {
        groupMap.set(group.id, group);
        for (const opt of group.options) {
            optionMap.set(opt.id, { ...opt, groupName: group.name });
        }
    }

    // Pass 1: Collect all modifiers by type (DO NOT apply in iteration order!)
    for (const [groupId, optionValue] of Object.entries(selections)) {
        const ids = Array.isArray(optionValue) ? optionValue : [optionValue];
        const group = groupMap.get(groupId);

        for (const optId of ids) {
            const option = optionMap.get(optId);
            if (!option) continue;

            switch (option.priceModifierType) {
                case "add":
                    additiveTotal += option.priceModifierAmount;
                    break;
                case "multiply":
                    multiplicativeFactor *= option.priceModifierAmount;
                    break;
                case "replace":
                    effectiveBase = option.priceModifierAmount;
                    break;
            }

            breakdown.push({
                groupId,
                groupName: group?.name || "",
                optionId: optId,
                optionName: option.name,
                modifierType: option.priceModifierType,
                modifierAmount: option.priceModifierAmount,
                lineTotal:
                    option.priceModifierType === "add" ? option.priceModifierAmount : 0,
            });
        }
    }

    // ─── APPLY OPERATIONS IN CORRECT ORDER ───
    // Step 1: Base + all additive modifiers
    const subtotalBeforeMultiply = effectiveBase + additiveTotal;

    // Step 2: Apply multiplicative modifiers
    const subtotalAfterMultiply = subtotalBeforeMultiply * multiplicativeFactor;

    // Step 3: Apply quantity discounts
    const discounts: DiscountDetail[] = [];
    let discountAmount = 0;

    const priceTierRules = rules
        .filter(
            (r) =>
                r.ruleType === "price_tier" &&
                r.isActive &&
                r.quantityMin &&
                r.quantityMin <= quantity
        )
        .sort((a, b) => (b.quantityMin || 0) - (a.quantityMin || 0));

    if (priceTierRules.length > 0) {
        const bestTier = priceTierRules[0];
        if (bestTier.discountType === "percentage" && bestTier.discountValue) {
            discountAmount = subtotalAfterMultiply * (bestTier.discountValue / 100);
            discounts.push({
                name: bestTier.name,
                type: "percentage",
                value: bestTier.discountValue,
                amount: discountAmount,
            });
        } else if (bestTier.discountType === "fixed_amount" && bestTier.discountValue) {
            discountAmount = bestTier.discountValue;
            discounts.push({
                name: bestTier.name,
                type: "fixed_amount",
                value: bestTier.discountValue,
                amount: discountAmount,
            });
        }
    }

    const perUnitPrice = subtotalAfterMultiply - discountAmount;

    return {
        basePrice: effectiveBase,
        optionsTotal: additiveTotal,
        subtotal: subtotalAfterMultiply,
        discounts,
        discountAmount,
        total: perUnitPrice * quantity,
        perUnitPrice,
        quantity,
        breakdown,
    };
}
