/**
 * Zod validation schemas for Phase 2 server actions.
 * Used by price-list, variant, profitability, and accounting actions.
 */
import { z } from "zod";

// ============================================================================
// SHARED
// ============================================================================

export const uuidSchema = z.string().uuid("Invalid UUID format");
export const tenantIdSchema = uuidSchema;

// ============================================================================
// PRICE LIST SCHEMAS
// ============================================================================

export const upsertPriceListSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional().nullable(),
    currency: z.string().length(3, "Currency code must be 3 characters").toUpperCase(),
    priority: z.number().int().min(0).max(1000),
    isActive: z.boolean().optional(),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be ISO date (YYYY-MM-DD)").optional().nullable(),
    validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be ISO date (YYYY-MM-DD)").optional().nullable(),
});

export const upsertPriceListItemSchema = z.object({
    unitPrice: z.number().min(0, "Unit price must be non-negative"),
    minQuantity: z.number().int().min(1).optional(),
    maxQuantity: z.number().int().min(1).optional().nullable(),
    discountPercent: z.number().min(0).max(100).optional(),
    notes: z.string().max(500).optional().nullable(),
});

// ============================================================================
// VARIANT SCHEMAS
// ============================================================================

export const createVariantAttributeSchema = z.object({
    name: z.string().min(1, "Attribute name is required").max(50),
    displayName: z.string().max(100).optional(),
    sortOrder: z.number().int().min(0).optional(),
});

export const addAttributeValueSchema = z.object({
    value: z.string().min(1, "Value is required").max(100),
    displayValue: z.string().max(100).optional(),
    colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
});

export const createVariantSchema = z.object({
    sku: z.string().min(1, "SKU is required").max(50),
    attributeValues: z.record(z.string(), z.string()),
    costPrice: z.number().min(0).optional(),
    listPrice: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
    barcode: z.string().max(50).optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
});

// ============================================================================
// PROFITABILITY SCHEMAS
// ============================================================================

export const validateMarginSchema = z.object({
    quoteId: uuidSchema,
});

export const marginActionSchema = z.object({
    quoteId: uuidSchema,
    notes: z.string().max(500).optional(),
});

// ============================================================================
// ACCOUNTING SCHEMAS
// ============================================================================

export const accountTypeSchema = z.enum([
    "asset", "liability", "equity", "revenue", "expense",
]);

export const createAccountSchema = z.object({
    accountNumber: z.string().min(1, "Account number is required").max(20),
    name: z.string().min(1, "Account name is required").max(100),
    accountType: accountTypeSchema,
    parentId: uuidSchema.optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    currency: z.string().length(3).toUpperCase().optional(),
});

export const journalLineSchema = z.object({
    accountId: uuidSchema,
    debit: z.number().min(0, "Debit must be non-negative"),
    credit: z.number().min(0, "Credit must be non-negative"),
    description: z.string().max(500).optional().nullable(),
});

export const createJournalEntrySchema = z.object({
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be ISO date").optional(),
    memo: z.string().max(500).optional().nullable(),
    referenceType: z.string().max(50).optional(),
    referenceId: uuidSchema.optional().nullable(),
    lines: z.array(journalLineSchema).min(2, "At least 2 lines required"),
});

// ============================================================================
// VENDOR SCHEMAS
// ============================================================================

export const createVendorSchema = z.object({
    name: z.string().min(1, "Vendor name is required").max(200),
    contactName: z.string().max(200).optional().nullable(),
    email: z.string().email("Invalid email").max(200).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    addressLine1: z.string().max(300).optional().nullable(),
    addressLine2: z.string().max(300).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    country: z.string().max(10).optional().nullable(),
    taxId: z.string().max(50).optional().nullable(),
    paymentTermsDays: z.number().int().min(0).max(365).optional(),
    notes: z.string().max(1000).optional().nullable(),
    isActive: z.boolean().optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

// ============================================================================
// PURCHASE ORDER SCHEMAS
// ============================================================================

export const createPurchaseOrderSchema = z.object({
    vendorId: uuidSchema,
    orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be ISO date").optional(),
    expectedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be ISO date").optional().nullable(),
    warehouseId: uuidSchema.optional().nullable(),
    taxZoneId: uuidSchema.optional().nullable(),
    currency: z.string().length(3).toUpperCase().optional(),
    notes: z.string().max(1000).optional().nullable(),
});

export const updatePurchaseOrderSchema = createPurchaseOrderSchema.partial();

export const purchaseOrderItemSchema = z.object({
    productId: uuidSchema.optional().nullable(),
    variantId: uuidSchema.optional().nullable(),
    description: z.string().min(1, "Description is required").max(500),
    quantity: z.number().min(0.0001, "Quantity must be positive"),
    unitPrice: z.number().min(0, "Unit price must be non-negative"),
    taxRate: z.number().min(0).max(1).optional(),
});

export const receiveItemSchema = z.object({
    itemId: uuidSchema,
    receivedQty: z.number().min(0, "Received quantity must be non-negative"),
});

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const paymentTypeSchema = z.enum(["customer_receipt", "vendor_payment"]);
export const paymentMethodSchema = z.enum(["cash", "bank_transfer", "check", "credit_card", "other"]);

export const createPaymentSchema = z.object({
    paymentType: paymentTypeSchema,
    entityType: z.enum(["customer", "vendor"]),
    entityId: uuidSchema,
    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be ISO date").optional(),
    paymentMethod: paymentMethodSchema,
    amount: z.number().min(0.01, "Amount must be positive"),
    currency: z.string().length(3).toUpperCase().optional(),
    reference: z.string().max(200).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
});

export const updatePaymentSchema = createPaymentSchema.partial();

export const paymentAllocationSchema = z.object({
    invoiceId: uuidSchema.optional().nullable(),
    poId: uuidSchema.optional().nullable(),
    amount: z.number().min(0.01, "Allocation amount must be positive"),
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validates input against a Zod schema.
 * Returns { success: true, data } or { success: false, error }.
 */
export function validateSchema<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; error: string } {
    try {
        const parsed = schema.parse(data);
        return { success: true, data: parsed };
    } catch (err) {
        if (err instanceof z.ZodError) {
            const messages = err.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return { success: false, error: `Validation error: ${messages}` };
        }
        return { success: false, error: "Validation error" };
    }
}
