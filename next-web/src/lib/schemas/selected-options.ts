import { z } from "zod";

// ============================================================================
// Selected Options Schema
// ============================================================================
// Used in: configurations.selected_options, template_presets.selected_options
//
// Structure: Record<groupId (UUID), optionId (UUID) | optionId[] (UUID[])>
// - Single-select groups: value is a single UUID string
// - Multi-select groups: value is an array of UUID strings
// ============================================================================

export const selectedOptionsSchema = z.record(
    z.string().uuid({ message: "Group ID must be a valid UUID" }),
    z.union([
        z.string().uuid({ message: "Option ID must be a valid UUID" }),
        z.array(z.string().uuid({ message: "Each option ID must be a valid UUID" })),
    ])
);

export type SelectedOptions = z.infer<typeof selectedOptionsSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/** Validate selected options and return parsed data or error */
export function validateSelectedOptions(data: unknown) {
    return selectedOptionsSchema.safeParse(data);
}

/** Check if a specific option is selected in any group */
export function isOptionInSelections(
    optionId: string,
    selections: SelectedOptions
): boolean {
    return Object.values(selections).some((value) => {
        if (Array.isArray(value)) return value.includes(optionId);
        return value === optionId;
    });
}

/** Count total selected options across all groups */
export function countSelectedOptions(selections: SelectedOptions): number {
    return Object.values(selections).reduce((count, value) => {
        return count + (Array.isArray(value) ? value.length : 1);
    }, 0);
}
