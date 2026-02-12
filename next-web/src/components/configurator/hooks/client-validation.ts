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
        const conditionMet =
            isOptionSelected(rule.ifOptionId, selections) ||
            isGroupSelected(rule.ifGroupId, selections) ||
            isOptionSelected(rule.ifProductId, selections); // For category-driven groups

        if (!conditionMet) continue;

        switch (rule.ruleType) {
            case "requires":
                if (rule.thenOptionId && !isOptionSelected(rule.thenOptionId, selections)) {
                    errors.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        message: rule.errorMessage || `${rule.name}`,
                        groupId: rule.thenGroupId,
                        optionId: rule.thenOptionId,
                        severity: "error",
                    });
                }
                if (rule.thenGroupId && !isGroupSelected(rule.thenGroupId, selections)) {
                    errors.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        message: rule.errorMessage || `${rule.name}`,
                        groupId: rule.thenGroupId,
                        optionId: null,
                        severity: "error",
                    });
                }
                break;

            case "conflicts":
                if (rule.thenOptionId && isOptionSelected(rule.thenOptionId, selections)) {
                    errors.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        message: rule.errorMessage || `${rule.name}`,
                        groupId: null,
                        optionId: rule.thenOptionId,
                        severity: "error",
                    });
                    disabledOptions.push(rule.thenOptionId);
                }
                break;

            case "hides":
                if (rule.thenOptionId) hiddenOptions.push(rule.thenOptionId);
                if (rule.thenGroupId) hiddenGroups.push(rule.thenGroupId);
                break;

            case "auto_select":
                if (rule.thenOptionId && rule.thenGroupId) {
                    autoSelections[rule.thenGroupId] = rule.thenOptionId;
                }
                break;
        }
    }

    return {
        isValid: errors.length === 0,
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
