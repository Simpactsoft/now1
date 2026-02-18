import { z } from "zod";

// ============================================================================
// TEMPLATE SCHEMAS
// ============================================================================

export const templateSchema = z.object({
    name: z.string().min(1, "Name is required").max(200, "Name too long"),
    description: z.string().optional(),
    basePrice: z.number().min(0, "Price cannot be negative"),
    displayMode: z.enum(["single_page", "wizard"]),
    isActive: z.boolean().default(false),
    imageUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
    categoryId: z.string().uuid("Invalid category ID").optional(),
    baseProductId: z.string().uuid("Invalid product ID").optional(),
});

export type TemplateFormData = z.infer<typeof templateSchema>;

// ============================================================================
// OPTION GROUP SCHEMAS
// ============================================================================

export const optionGroupSchema = z.object({
    templateId: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    selectionType: z.enum(["single", "multiple"]),
    isRequired: z.boolean(),
    minSelections: z.number().int().min(0).default(0),
    maxSelections: z.number().int().min(1).optional(),
    sourceType: z.enum(["manual", "category"]),
    // Accepts null (from JSON), undefined (omitted), or valid UUID
    // DO NOT simplify to just .optional() - client sends null for manual sourceType
    sourceCategoryId: z.string().uuid().nullable().optional(),
    // Can be undefined when sourceType is "manual"
    // DO NOT use .default() - it doesn't work with safeParse() when value is missing
    categoryPriceMode: z
        .enum(["list_price", "cost_plus", "explicit"])
        .optional(),
}).refine(
    (d) => d.sourceType !== "category" || d.sourceCategoryId,
    {
        message: "Category source requires a source category",
        path: ["sourceCategoryId"],
    }
).refine(
    (d) => d.sourceType !== "category" || d.categoryPriceMode,
    {
        message: "Category source requires a price mode",
        path: ["categoryPriceMode"],
    }
).refine(
    (d) =>
        d.selectionType !== "multiple" ||
        !d.maxSelections ||
        !d.minSelections ||
        d.maxSelections >= d.minSelections,
    {
        message: "Max selections must be ≥ min selections",
        path: ["maxSelections"],
    }
);

export type OptionGroupFormData = z.infer<typeof optionGroupSchema>;

// ============================================================================
// OPTION SCHEMAS
// ============================================================================

export const optionSchema = z.object({
    groupId: z.string().uuid(),
    name: z.string().min(1).max(200),
    sku: z.string().max(100).optional(),
    productId: z.string().uuid().optional(),
    priceModifierType: z.enum(["add", "multiply", "replace"]),
    priceModifierAmount: z.number(),
    isDefault: z.boolean().default(false),
    isAvailable: z.boolean().default(true),
    imageUrl: z.string().url().optional().or(z.literal("")),
});

export type OptionFormData = z.infer<typeof optionSchema>;

// ============================================================================
// OPTION OVERRIDE SCHEMAS
// ============================================================================

export const optionOverrideSchema = z.object({
    groupId: z.string().uuid(),
    productId: z.string().uuid(),
    priceModifierType: z.enum(["add", "multiply", "replace"]).optional(),
    priceModifierAmount: z.number().optional(),
    isDefault: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
    customName: z.string().max(200).optional(),
    customDescription: z.string().optional(),
});

export type OptionOverrideFormData = z.infer<typeof optionOverrideSchema>;

// ============================================================================
// RULE SCHEMAS
// ============================================================================

export const ruleSchema = z.object({
    templateId: z.string().uuid(),
    ruleType: z.enum(["requires", "conflicts", "hides", "auto_select", "price_tier"]),
    ifOptionId: z.string().uuid().optional(),
    ifGroupId: z.string().uuid().optional(),
    ifProductId: z.string().uuid().optional(),
    thenOptionId: z.string().uuid().optional(),
    thenGroupId: z.string().uuid().optional(),
    thenProductId: z.string().uuid().optional(),
    priority: z.number().int().default(0),
    errorMessage: z.string().max(500).optional(),
}).refine(
    (d) => d.ifOptionId || d.ifGroupId || d.ifProductId,
    { message: "At least one IF condition is required" }
).refine(
    (d) => d.thenOptionId || d.thenGroupId || d.thenProductId,
    { message: "At least one THEN target is required" }
);

export type RuleFormData = z.infer<typeof ruleSchema>;

// ============================================================================
// PRESET SCHEMAS
// ============================================================================

export const presetSchema = z.object({
    templateId: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    selectedOptions: z.record(
        z.string().uuid(),
        z.union([z.string().uuid(), z.array(z.string().uuid())])
    ),
});

export type PresetFormData = z.infer<typeof presetSchema>;

// ============================================================================
// CONFIGURATION SCHEMAS
// ============================================================================

export const configurationSchema = z.object({
    templateId: z.string().uuid(),
    selectedOptions: z.record(
        z.string().uuid(),
        z.union([z.string().uuid(), z.array(z.string().uuid())])
    ),
    status: z.enum(["draft", "completed"]).default("draft"),
});

export type ConfigurationFormData = z.infer<typeof configurationSchema>;
