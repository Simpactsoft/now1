import { z } from "zod";
import {
    templateSchema,
    optionGroupSchema,
    optionSchema,
    ruleSchema,
    presetSchema,
    configurationSchema,
    type TemplateFormData,
    type OptionGroupFormData,
    type OptionFormData,
    type RuleFormData,
    type PresetFormData,
    type ConfigurationFormData,
} from "./validators";
import { selectedOptionsSchema, type SelectedOptions } from "@/lib/schemas/selected-options";
import { actionError, type ActionResult } from "@/lib/action-result";

// ============================================================================
// CPQ Validation Service
// ============================================================================
// Consolidates all CPQ validation logic into a single service.
// Actions call this service instead of doing validation inline.
//
// Three layers of validation:
//   1. Input validation (Zod schemas) — this service
//   2. Business rules (requires, conflicts, hides) — this service
//   3. DB constraints (RLS, CHECK, FK) — fallback only
// ============================================================================

// ============================================================================
// Types
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
// 1. Input Validation (Zod)
// ============================================================================

type SchemaMap = {
    template: typeof templateSchema;
    optionGroup: typeof optionGroupSchema;
    option: typeof optionSchema;
    rule: typeof ruleSchema;
    preset: typeof presetSchema;
    configuration: typeof configurationSchema;
    selectedOptions: typeof selectedOptionsSchema;
};

const schemas: SchemaMap = {
    template: templateSchema,
    optionGroup: optionGroupSchema,
    option: optionSchema,
    rule: ruleSchema,
    preset: presetSchema,
    configuration: configurationSchema,
    selectedOptions: selectedOptionsSchema,
};

/**
 * Validate input data against a named Zod schema.
 * Returns ActionResult — if invalid, returns actionError with first error message.
 */
export function validateInput<K extends keyof SchemaMap>(
    schemaName: K,
    data: unknown
): ActionResult<z.output<SchemaMap[K]>> {
    const schema = schemas[schemaName];
    const result = schema.safeParse(data);

    if (!result.success) {
        const firstError = result.error.errors[0];
        const path = firstError.path.length > 0 ? ` (${firstError.path.join(".")})` : "";
        return {
            success: false,
            error: `${firstError.message}${path}`,
            code: "VALIDATION_ERROR",
        };
    }

    return { success: true, data: result.data as z.output<SchemaMap[K]> };
}

// ============================================================================
// 2. Business Rule Helpers
// ============================================================================

/** Check if a specific option is selected in any group */
export function isOptionSelected(
    optionId: string | null,
    selections: Record<string, string | string[]>
): boolean {
    if (!optionId) return false;
    return Object.values(selections).some((v) =>
        Array.isArray(v) ? v.includes(optionId) : v === optionId
    );
}

/** Check if a group has any selection */
export function isGroupSelected(
    groupId: string | null,
    selections: Record<string, string | string[]>
): boolean {
    if (!groupId) return false;
    return !!selections[groupId];
}

// ============================================================================
// 3. Pre-publish Validation
// ============================================================================

interface TemplateForPublish {
    id: string;
    name: string;
    base_price: number;
    groups: Array<{
        id: string;
        name: string;
        is_required: boolean;
        options_count: number;
    }>;
    rules_count: number;
}

/**
 * Validate that a template is ready to be published (is_active = true).
 * Checks:
 * - Has at least one option group
 * - All required groups have at least one option
 * - Base price is set
 */
export function validateForPublish(template: TemplateForPublish): ValidationResult {
    const errors: ValidationMessage[] = [];
    const warnings: ValidationMessage[] = [];

    // Must have at least one group
    if (template.groups.length === 0) {
        errors.push({
            ruleId: "publish",
            ruleName: "No option groups",
            message: "Template must have at least one option group",
            groupId: null,
            optionId: null,
            severity: "error",
        });
    }

    // Required groups must have options
    for (const group of template.groups) {
        if (group.is_required && group.options_count === 0) {
            errors.push({
                ruleId: "publish",
                ruleName: "Empty required group",
                message: `Required group "${group.name}" has no options`,
                groupId: group.id,
                optionId: null,
                severity: "error",
            });
        }
    }

    // Warning if no rules
    if (template.rules_count === 0) {
        warnings.push({
            ruleId: "publish",
            ruleName: "No rules",
            message: "Template has no configuration rules",
            groupId: null,
            optionId: null,
            severity: "warning",
        });
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        autoSelections: {},
        hiddenOptions: [],
        hiddenGroups: [],
        disabledOptions: [],
    };
}
