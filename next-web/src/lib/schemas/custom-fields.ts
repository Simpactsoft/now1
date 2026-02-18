import { z } from "zod";

// ============================================================================
// Custom Fields Schema
// ============================================================================
// Used in: parties.custom_fields, cards.custom_fields
//
// Structure: Record<string, unknown>
// - Keys are field names (user-defined)
// - Values can be string, number, boolean, date string, or null
// ============================================================================

const customFieldValueSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
]);

export const customFieldsSchema = z.record(
    z.string().min(1, "Field name cannot be empty"),
    customFieldValueSchema
);

export type CustomFields = z.infer<typeof customFieldsSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/** Validate custom fields and return parsed data or error */
export function validateCustomFields(data: unknown) {
    return customFieldsSchema.safeParse(data);
}

/** Safely get a custom field value with type checking */
export function getCustomField<T extends string | number | boolean | null>(
    fields: CustomFields | undefined | null,
    key: string,
    defaultValue: T
): T {
    if (!fields || !(key in fields)) return defaultValue;
    return fields[key] as T;
}
