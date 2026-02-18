"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { ConfigurationRule, Option, OptionGroup } from "./template-actions";

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Validate a configuration against all business rules.
 * Called by frontend for real-time feedback on every selection change.
 * 
 * Target performance: <50ms
 */
export async function validateConfiguration(params: {
    templateId: string;
    selectedOptions: Record<string, string | string[]>;
}): Promise<{
    success: boolean;
    data?: ValidationResult;
    error?: string;
}> {
    try {
        console.log('[Server Validation] Starting', {
            templateId: params.templateId,
            selections: params.selectedOptions,
        });

        const supabase = await createClient();

        const errors: ValidationMessage[] = [];
        const warnings: ValidationMessage[] = [];
        const hiddenOptions: string[] = [];
        const hiddenGroups: string[] = [];
        const disabledOptions: string[] = [];
        const autoSelections: Record<string, string> = {};

        // 1. Get option groups
        const { data: groupsData, error: groupsError } = await supabase
            .from("option_groups")
            .select("*")
            .eq("template_id", params.templateId);

        if (groupsError) {
            return { success: false, error: groupsError.message };
        }

        // 2. Check required groups
        for (const group of groupsData || []) {
            if (group.is_required && !params.selectedOptions[group.id]) {
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

        // 3. Check min/max selections for multi-select groups
        for (const group of groupsData || []) {
            if (group.selection_type === "multiple" && params.selectedOptions[group.id]) {
                const selected = Array.isArray(params.selectedOptions[group.id])
                    ? (params.selectedOptions[group.id] as string[])
                    : [params.selectedOptions[group.id] as string];

                if (selected.length < group.min_selections) {
                    errors.push({
                        ruleId: "system",
                        ruleName: "Min selections",
                        message: `${group.name} requires at least ${group.min_selections} selection(s)`,
                        groupId: group.id,
                        optionId: null,
                        severity: "error",
                    });
                }

                if (group.max_selections && selected.length > group.max_selections) {
                    errors.push({
                        ruleId: "system",
                        ruleName: "Max selections",
                        message: `${group.name} allows at most ${group.max_selections} selection(s)`,
                        groupId: group.id,
                        optionId: null,
                        severity: "error",
                    });
                }
            }
        }

        // 4. Get and evaluate rules
        const { data: rulesData, error: rulesError } = await supabase
            .from("configuration_rules")
            .select("*")
            .eq("template_id", params.templateId)
            .eq("is_active", true)
            .order("priority");

        if (rulesError) {
            return { success: false, error: rulesError.message };
        }

        for (const rule of rulesData || []) {
            const conditionMet =
                isOptionSelected(rule.if_option_id, params.selectedOptions) ||
                isGroupSelected(rule.if_group_id, params.selectedOptions);

            if (!conditionMet) continue;

            switch (rule.rule_type) {
                case "requires":
                    if (rule.then_option_id && !isOptionSelected(rule.then_option_id, params.selectedOptions)) {
                        errors.push({
                            ruleId: rule.id,
                            ruleName: rule.name,
                            message: rule.error_message || rule.name,
                            groupId: rule.then_group_id,
                            optionId: rule.then_option_id,
                            severity: "error",
                        });
                    }
                    if (rule.then_group_id) {
                        const rawSelected = params.selectedOptions[rule.then_group_id];
                        const selectedOption: string | undefined = Array.isArray(rawSelected) ? rawSelected[0] : rawSelected;

                        // Group is required but nothing selected
                        if (!selectedOption) {
                            errors.push({
                                ruleId: rule.id,
                                ruleName: rule.name,
                                message: rule.error_message || rule.name,
                                groupId: rule.then_group_id,
                                optionId: null,
                                severity: "error",
                            });
                        }
                        // Group has selection, but if allowed_options specified, validate it's in the list
                        else if (rule.allowed_options && rule.allowed_options.length > 0) {
                            if (!rule.allowed_options.includes(selectedOption)) {
                                errors.push({
                                    ruleId: rule.id,
                                    ruleName: rule.name,
                                    message: rule.error_message || rule.name,
                                    groupId: rule.then_group_id,
                                    optionId: selectedOption,
                                    severity: "error",
                                });
                            }
                        }
                    }
                    break;

                case "conflicts":
                    if (rule.then_option_id && isOptionSelected(rule.then_option_id, params.selectedOptions)) {
                        // Find which group this option belongs to using groupsData
                        let optionGroupId: string | null = null;
                        for (const g of groupsData || []) {
                            const { data: opts } = await supabase
                                .from("options")
                                .select("id")
                                .eq("group_id", g.id)
                                .eq("id", rule.then_option_id)
                                .maybeSingle();
                            if (opts) {
                                optionGroupId = g.id;
                                break;
                            }
                        }

                        errors.push({
                            ruleId: rule.id,
                            ruleName: rule.name,
                            message: rule.error_message || rule.name,
                            groupId: optionGroupId,
                            optionId: rule.then_option_id,
                            severity: "error",
                        });
                        disabledOptions.push(rule.then_option_id);
                    }
                    break;

                case "hides":
                    if (rule.then_option_id) hiddenOptions.push(rule.then_option_id);
                    if (rule.then_group_id) hiddenGroups.push(rule.then_group_id);
                    break;

                case "auto_select":
                    if (rule.then_option_id && rule.then_group_id) {
                        autoSelections[rule.then_group_id] = rule.then_option_id;
                    }
                    break;
            }
        }

        const isValid = errors.length === 0;
        console.log('[Server Validation] END', {
            isValid,
            errorsCount: errors.length,
            errors: errors.map(e => ({ message: e.message, groupId: e.groupId })),
        });

        return {
            success: true,
            data: {
                isValid,
                errors,
                warnings,
                autoSelections,
                hiddenOptions,
                hiddenGroups,
                disabledOptions,
            },
        };
    } catch (error: any) {
        console.error("Error in validateConfiguration:", error);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
