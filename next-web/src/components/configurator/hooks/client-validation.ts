/**
 * Client-side validation logic.
 * MUST match server-side validation exactly.
 * 
 * Used for instant feedback in the configurator UI.
 * Server validation is still authoritative.
 */

import type { OptionGroup, ConfigurationRule } from "@/app/actions/cpq/template-actions";

export interface ValidationMessage {
    ruleId: string;
    ruleName: string;
    message: string;
    groupId: string | null;
    optionId: string | null;
    severity: "error" | "warning" | "info";
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationMessage[];
    warnings: ValidationMessage[];
    autoSelections: Record<string, string>;
    hiddenOptions: string[];
    hiddenGroups: string[];
    disabledOptions: string[];
}

/**
 * Validate configuration client-side for instant feedback.
 */
export function validateConfigurationClientSide(
    optionGroups: OptionGroup[],
    selections: Record<string, string | string[]>,
    rules: ConfigurationRule[]
): ValidationResult {

    const errors: ValidationMessage[] = [];
    const warnings: ValidationMessage[] = [];
    const hiddenOptions: string[] = [];
    const hiddenGroups: string[] = [];
    const disabledOptions: string[] = [];
    const autoSelections: Record<string, string> = {};

    // 1. Check required groups
    for (const group of optionGroups) {
        if (group.isRequired && !selections[group.id]) {
            errors.push({
                ruleId: "system",
                ruleName: "Required group",
                message: `${group.name} is required`,
                groupId: group.id,
                optionId: null,
                severity: "error",
            });
        }
    }

    // 2. Check min/max selections for multi-select groups
    for (const group of optionGroups) {
        if (group.selectionType === "multiple" && selections[group.id]) {
            const selected = Array.isArray(selections[group.id])
                ? (selections[group.id] as string[])
                : [selections[group.id] as string];

            if (selected.length < group.minSelections) {
                errors.push({
                    ruleId: "system",
                    ruleName: "Min selections",
                    message: `${group.name} requires at least ${group.minSelections} selection(s)`,
                    groupId: group.id,
                    optionId: null,
                    severity: "error",
                });
            }

            if (group.maxSelections && selected.length > group.maxSelections) {
                errors.push({
                    ruleId: "system",
                    ruleName: "Max selections",
                    message: `${group.name} allows at most ${group.maxSelections} selection(s)`,
                    groupId: group.id,
                    optionId: null,
                    severity: "error",
                });
            }
        }
    }

    // 3. Evaluate rules (sorted by priority)
    const activeRules = rules.filter((r) => r.isActive).sort((a, b) => a.priority - b.priority);

    for (const rule of activeRules) {
        // Handle both camelCase and snake_case property names from database
        const ifOptionId = (rule as any).ifOptionId || (rule as any).if_option_id;
        const ifGroupId = (rule as any).ifGroupId || (rule as any).if_group_id;
        const ifProductId = (rule as any).ifProductId || (rule as any).if_product_id;
        const thenOptionId = (rule as any).thenOptionId || (rule as any).then_option_id;
        const thenGroupId = (rule as any).thenGroupId || (rule as any).then_group_id;
        const ruleType = (rule as any).ruleType || (rule as any).rule_type;
        const errorMessage = (rule as any).errorMessage || (rule as any).error_message;

        const conditionMet =
            isOptionSelected(ifOptionId, selections) ||
            isGroupSelected(ifGroupId, selections) ||
            isOptionSelected(ifProductId, selections); // For category-driven groups

        if (!conditionMet) continue;

        switch (ruleType) {
            case "requires":
                if (thenOptionId && !isOptionSelected(thenOptionId, selections)) {
                    errors.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        message: errorMessage || `${rule.name}`,
                        groupId: thenGroupId,
                        optionId: thenOptionId,
                        severity: "error",
                    });
                }
                if (thenGroupId) {
                    const selectedOption = selections[thenGroupId];

                    // Group is required but nothing selected
                    if (!selectedOption) {
                        errors.push({
                            ruleId: rule.id,
                            ruleName: rule.name,
                            message: errorMessage || `${rule.name}`,
                            groupId: thenGroupId,
                            optionId: null,
                            severity: "error",
                        });
                    }
                    // Group has selection, but if allowed_options specified, validate it's in the list
                    else if (rule.allowedOptions && rule.allowedOptions.length > 0) {
                        if (!rule.allowedOptions.includes(selectedOption)) {
                            errors.push({
                                ruleId: rule.id,
                                ruleName: rule.name,
                                message: errorMessage || `${rule.name}`,
                                groupId: thenGroupId,
                                optionId: selectedOption,
                                severity: "error",
                            });
                        }
                    }
                }
                break;

            case "conflicts":
                if (thenOptionId && isOptionSelected(thenOptionId, selections)) {
                    // Find which group this option belongs to
                    const optionGroupId = optionGroups.find(g =>
                        g.options.some(o => o.id === thenOptionId)
                    )?.id || null;

                    errors.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        message: errorMessage || `${rule.name}`,
                        groupId: optionGroupId,
                        optionId: thenOptionId,
                        severity: "error",
                    });
                    disabledOptions.push(thenOptionId);
                }
                break;

            case "hides":
                if (thenOptionId) hiddenOptions.push(thenOptionId);
                if (thenGroupId) hiddenGroups.push(thenGroupId);
                break;

            case "auto_select":
                if (thenOptionId && thenGroupId) {
                    autoSelections[thenGroupId] = thenOptionId;
                }
                break;
        }
    }

    const isValid = errors.length === 0;

    console.log('[Validation] ===== END =====', {
        timestamp: new Date().toISOString(),
        isValid,
        errorsCount: errors.length,
        errors: errors.map(e => e.message),
    });

    return {
        isValid,
        errors,
        warnings,
        autoSelections,
        hiddenOptions,
        hiddenGroups,
        disabledOptions,
    };
}

// Helper functions
function isOptionSelected(
    optionId: string | null,
    selections: Record<string, string | string[]>
): boolean {
    if (!optionId) return false;
    return Object.values(selections).some((v) =>
        Array.isArray(v) ? v.includes(optionId) : v === optionId
    );
}

function isGroupSelected(
    groupId: string | null,
    selections: Record<string, string | string[]>
): boolean {
    if (!groupId) return false;
    return !!selections[groupId];
}
