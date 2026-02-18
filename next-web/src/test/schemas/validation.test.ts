import { describe, it, expect } from 'vitest'

// CPQ Schemas
import { templateSchema, optionGroupSchema, optionSchema, configurationSchema } from '@/lib/cpq/validators'

// Domain Schemas
import { contactMethodsSchema, contactMethodSchema } from '@/lib/schemas/contact-methods'
import { customFieldsSchema } from '@/lib/schemas/custom-fields'
import { sourceSnapshotSchema } from '@/lib/schemas/source-snapshot'
import { priceBreakdownItemSchema } from '@/lib/schemas/price-breakdown'
import { selectedOptionsSchema } from '@/lib/schemas/selected-options'

// ============================================================================
// TEST 4 — Zod Schema Validation
// ============================================================================

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';

describe('Zod Schema Validation', () => {

    // ---- templateSchema ----
    describe('templateSchema', () => {
        it('should pass for valid template input', () => {
            const result = templateSchema.safeParse({
                name: 'My Template',
                basePrice: 100,
                displayMode: 'single_page',
            });
            expect(result.success).toBe(true);
        });

        it('should fail when name is empty', () => {
            const result = templateSchema.safeParse({
                name: '',
                basePrice: 100,
                displayMode: 'single_page',
            });
            expect(result.success).toBe(false);
        });

        it('should fail when basePrice is negative', () => {
            const result = templateSchema.safeParse({
                name: 'Test',
                basePrice: -10,
                displayMode: 'single_page',
            });
            expect(result.success).toBe(false);
        });

        it('should fail for invalid displayMode', () => {
            const result = templateSchema.safeParse({
                name: 'Test',
                basePrice: 100,
                displayMode: 'invalid_mode',
            });
            expect(result.success).toBe(false);
        });
    });

    // ---- optionGroupSchema ----
    describe('optionGroupSchema', () => {
        const validGroup = {
            templateId: VALID_UUID,
            name: 'Colors',
            selectionType: 'single' as const,
            isRequired: true,
            sourceType: 'manual' as const,
        };

        it('should pass for valid option group', () => {
            const result = optionGroupSchema.safeParse(validGroup);
            expect(result.success).toBe(true);
        });

        it('should fail when required fields are missing', () => {
            const result = optionGroupSchema.safeParse({
                name: 'Colors',
                // missing templateId, selectionType, isRequired, sourceType
            });
            expect(result.success).toBe(false);
        });

        it('should fail for invalid selectionType', () => {
            const result = optionGroupSchema.safeParse({
                ...validGroup,
                selectionType: 'triple',
            });
            expect(result.success).toBe(false);
        });

        it('should fail when category source has no sourceCategoryId', () => {
            const result = optionGroupSchema.safeParse({
                ...validGroup,
                sourceType: 'category',
                // missing sourceCategoryId
                categoryPriceMode: 'list_price',
            });
            expect(result.success).toBe(false);
        });

        it('should fail when category source has no categoryPriceMode', () => {
            const result = optionGroupSchema.safeParse({
                ...validGroup,
                sourceType: 'category',
                sourceCategoryId: VALID_UUID,
                // missing categoryPriceMode
            });
            expect(result.success).toBe(false);
        });

        it('should pass for category source with all required fields', () => {
            const result = optionGroupSchema.safeParse({
                ...validGroup,
                sourceType: 'category',
                sourceCategoryId: VALID_UUID,
                categoryPriceMode: 'list_price',
            });
            expect(result.success).toBe(true);
        });
    });

    // ---- optionSchema ----
    describe('optionSchema', () => {
        it('should pass for valid option', () => {
            const result = optionSchema.safeParse({
                groupId: VALID_UUID,
                name: 'Red',
                priceModifierType: 'add',
                priceModifierAmount: 50,
            });
            expect(result.success).toBe(true);
        });

        it('should fail for invalid priceModifierType', () => {
            const result = optionSchema.safeParse({
                groupId: VALID_UUID,
                name: 'Red',
                priceModifierType: 'subtract',
                priceModifierAmount: 50,
            });
            expect(result.success).toBe(false);
        });
    });

    // ---- configurationSchema ----
    describe('configurationSchema', () => {
        it('should pass for valid selected_options structure', () => {
            const result = configurationSchema.safeParse({
                templateId: VALID_UUID,
                selectedOptions: {
                    [VALID_UUID]: VALID_UUID_2,
                },
                status: 'draft',
            });
            expect(result.success).toBe(true);
        });

        it('should pass for selected_options with array values', () => {
            const result = configurationSchema.safeParse({
                templateId: VALID_UUID,
                selectedOptions: {
                    [VALID_UUID]: [VALID_UUID_2, VALID_UUID],
                },
            });
            expect(result.success).toBe(true);
        });

        it('should fail when status is not in allowed values', () => {
            const result = configurationSchema.safeParse({
                templateId: VALID_UUID,
                selectedOptions: {},
                status: 'cancelled',
            });
            expect(result.success).toBe(false);
        });

        it('should default status to draft when not provided', () => {
            const result = configurationSchema.safeParse({
                templateId: VALID_UUID,
                selectedOptions: {},
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('draft');
            }
        });
    });

    // ---- contactMethodsSchema ----
    describe('contactMethodsSchema', () => {
        it('should pass for valid email contact method', () => {
            const result = contactMethodsSchema.safeParse([
                { type: 'email', value: 'test@example.com', isPrimary: true },
            ]);
            expect(result.success).toBe(true);
        });

        it('should pass for valid phone contact method', () => {
            const result = contactMethodsSchema.safeParse([
                { type: 'phone', value: '+1234567890', isPrimary: false },
            ]);
            expect(result.success).toBe(true);
        });

        it('should fail for invalid contact type', () => {
            const result = contactMethodsSchema.safeParse([
                { type: 'telegram', value: '@user', isPrimary: false },
            ]);
            expect(result.success).toBe(false);
        });

        it('should fail when value is empty', () => {
            const result = contactMethodsSchema.safeParse([
                { type: 'email', value: '', isPrimary: false },
            ]);
            expect(result.success).toBe(false);
        });

        it('should pass for multiple contact methods', () => {
            const result = contactMethodsSchema.safeParse([
                { type: 'email', value: 'a@b.com', isPrimary: true },
                { type: 'phone', value: '123', isPrimary: false },
                { type: 'website', value: 'https://example.com', isPrimary: false },
            ]);
            expect(result.success).toBe(true);
        });
    });

    // ---- customFieldsSchema ----
    describe('customFieldsSchema', () => {
        it('should pass for string values', () => {
            const result = customFieldsSchema.safeParse({ region: 'EMEA' });
            expect(result.success).toBe(true);
        });

        it('should pass for number values', () => {
            const result = customFieldsSchema.safeParse({ revenue: 1000000 });
            expect(result.success).toBe(true);
        });

        it('should pass for boolean values', () => {
            const result = customFieldsSchema.safeParse({ isEnterprise: true });
            expect(result.success).toBe(true);
        });

        it('should pass for null values', () => {
            const result = customFieldsSchema.safeParse({ notes: null });
            expect(result.success).toBe(true);
        });

        it('should pass for mixed value types', () => {
            const result = customFieldsSchema.safeParse({
                name: 'Test',
                count: 42,
                active: false,
                deleted: null,
            });
            expect(result.success).toBe(true);
        });

        it('should fail for empty field name', () => {
            const result = customFieldsSchema.safeParse({ '': 'value' });
            expect(result.success).toBe(false);
        });
    });

    // ---- sourceSnapshotSchema ----
    describe('sourceSnapshotSchema', () => {
        it('should pass for valid structure', () => {
            const result = sourceSnapshotSchema.safeParse({
                clonedAt: '2026-01-15T10:00:00Z',
                sourceType: 'template',
                templateId: VALID_UUID,
                templateName: 'My Template',
                basePrice: 1000,
                optionGroups: [
                    {
                        id: VALID_UUID,
                        name: 'Size',
                        options: [
                            {
                                id: VALID_UUID_2,
                                name: 'Large',
                                priceModifierType: 'add',
                                priceModifierAmount: 200,
                            },
                        ],
                    },
                ],
                selectedOptions: { [VALID_UUID]: VALID_UUID_2 },
                totalPrice: 1200,
            });
            expect(result.success).toBe(true);
        });

        it('should fail for invalid sourceType', () => {
            const result = sourceSnapshotSchema.safeParse({
                clonedAt: '2026-01-15',
                sourceType: 'preset', // invalid
                templateId: VALID_UUID,
                templateName: 'Test',
                basePrice: 100,
                optionGroups: [],
                selectedOptions: {},
                totalPrice: 100,
            });
            expect(result.success).toBe(false);
        });
    });

    // ---- priceBreakdownItemSchema ----
    describe('priceBreakdownItemSchema', () => {
        it('should pass for valid item', () => {
            const result = priceBreakdownItemSchema.safeParse({
                groupId: VALID_UUID,
                groupName: 'Size',
                optionId: VALID_UUID_2,
                optionName: 'Large',
                modifierType: 'add',
                modifierAmount: 200,
                lineTotal: 200,
            });
            expect(result.success).toBe(true);
        });

        it('should fail for invalid modifierType', () => {
            const result = priceBreakdownItemSchema.safeParse({
                groupId: VALID_UUID,
                groupName: 'Size',
                optionId: VALID_UUID_2,
                optionName: 'Large',
                modifierType: 'subtract',
                modifierAmount: 200,
                lineTotal: 200,
            });
            expect(result.success).toBe(false);
        });
    });

    // ---- selectedOptionsSchema ----
    describe('selectedOptionsSchema', () => {
        it('should pass for valid single option selection', () => {
            const result = selectedOptionsSchema.safeParse({
                [VALID_UUID]: VALID_UUID_2,
            });
            expect(result.success).toBe(true);
        });

        it('should pass for valid multi option selection', () => {
            const result = selectedOptionsSchema.safeParse({
                [VALID_UUID]: [VALID_UUID, VALID_UUID_2],
            });
            expect(result.success).toBe(true);
        });

        it('should fail when group key is not UUID', () => {
            const result = selectedOptionsSchema.safeParse({
                'not-a-uuid': VALID_UUID,
            });
            expect(result.success).toBe(false);
        });

        it('should fail when option value is not UUID', () => {
            const result = selectedOptionsSchema.safeParse({
                [VALID_UUID]: 'not-a-uuid',
            });
            expect(result.success).toBe(false);
        });
    });
});
