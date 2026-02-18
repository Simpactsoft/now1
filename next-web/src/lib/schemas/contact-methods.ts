import { z } from "zod";

// ============================================================================
// Contact Methods Schema
// ============================================================================
// Used in: cards.contact_methods (JSONB array)
//
// Structure: Array of { type, value, isPrimary, label? }
// - type: "email" | "phone" | "mobile" | "fax" | "website" | "other"
// - value: the actual contact value (email address, phone number, etc.)
// - isPrimary: boolean, at most one per type should be primary
// - label: optional display label (e.g., "Work", "Home")
// ============================================================================

export const contactMethodSchema = z.object({
    type: z.enum(["email", "phone", "mobile", "fax", "website", "other"]),
    value: z.string().min(1, "Contact value is required"),
    isPrimary: z.boolean().default(false),
    label: z.string().max(50).optional(),
});

export const contactMethodsSchema = z.array(contactMethodSchema);

export type ContactMethod = z.infer<typeof contactMethodSchema>;
export type ContactMethods = z.infer<typeof contactMethodsSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/** Validate contact methods array */
export function validateContactMethods(data: unknown) {
    return contactMethodsSchema.safeParse(data);
}

/** Get the primary contact of a given type */
export function getPrimaryContact(
    methods: ContactMethods | undefined | null,
    type: ContactMethod["type"]
): string | undefined {
    if (!methods) return undefined;
    const primary = methods.find((m) => m.type === type && m.isPrimary);
    if (primary) return primary.value;
    // Fallback to first of type
    const first = methods.find((m) => m.type === type);
    return first?.value;
}

/** Get primary email */
export function getPrimaryEmail(methods: ContactMethods | undefined | null): string | undefined {
    return getPrimaryContact(methods, "email");
}

/** Get primary phone */
export function getPrimaryPhone(methods: ContactMethods | undefined | null): string | undefined {
    return getPrimaryContact(methods, "phone") || getPrimaryContact(methods, "mobile");
}
