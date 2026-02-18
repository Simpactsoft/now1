import { describe, it, expect } from 'vitest'
import {
    validateInput,
    isOptionSelected,
    isGroupSelected,
    validateForPublish,
} from '@/lib/cpq/CPQValidationService'

// ============================================================================
// TEST 2 — CPQ Validation Service
// ============================================================================

describe('CPQValidationService', () => {

    // ---- isOptionSelected ----
    describe('isOptionSelected', () => {
        it('should return true when option is selected as a single value', () => {
            const selections = { 'group-1': 'option-a' };
            expect(isOptionSelected('option-a', selections)).toBe(true);
        });

        it('should return true when option is in an array value', () => {
            const selections = { 'group-1': ['option-a', 'option-b'] };
            expect(isOptionSelected('option-b', selections)).toBe(true);
        });

        it('should return false when option is not selected', () => {
            const selections = { 'group-1': 'option-a' };
            expect(isOptionSelected('option-c', selections)).toBe(false);
        });

        it('should return false when optionId is null', () => {
            const selections = { 'group-1': 'option-a' };
            expect(isOptionSelected(null, selections)).toBe(false);
        });

        it('should return false when selections are empty', () => {
            expect(isOptionSelected('option-a', {})).toBe(false);
        });
    });

    // ---- isGroupSelected ----
    describe('isGroupSelected', () => {
        it('should return true when group has a selection', () => {
            const selections = { 'group-1': 'option-a' };
            expect(isGroupSelected('group-1', selections)).toBe(true);
        });

        it('should return false when group has no selection', () => {
            const selections = { 'group-1': 'option-a' };
            expect(isGroupSelected('group-2', selections)).toBe(false);
        });

        it('should return false when groupId is null', () => {
            const selections = { 'group-1': 'option-a' };
            expect(isGroupSelected(null, selections)).toBe(false);
        });
    });

    // ---- validateInput ----
    describe('validateInput', () => {
        it('should validate a valid template input', () => {
            const result = validateInput('template', {
                name: 'Test Template',
                basePrice: 100,
                displayMode: 'single_page',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('Test Template');
            }
        });

        it('should reject invalid template input (missing name)', () => {
            const result = validateInput('template', {
                basePrice: 100,
                displayMode: 'single_page',
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeDefined();
                expect(result.code).toBe('VALIDATION_ERROR');
            }
        });

        it('should validate a valid option input', () => {
            const result = validateInput('option', {
                groupId: '550e8400-e29b-41d4-a716-446655440000',
                name: 'Large Size',
                priceModifierType: 'add',
                priceModifierAmount: 50,
            });
            expect(result.success).toBe(true);
        });

        it('should reject invalid option input (non-uuid groupId)', () => {
            const result = validateInput('option', {
                groupId: 'not-a-uuid',
                name: 'Large Size',
                priceModifierType: 'add',
                priceModifierAmount: 50,
            });
            expect(result.success).toBe(false);
        });
    });

    // ---- validateForPublish ----
    describe('validateForPublish', () => {
        it('should be valid for a template with groups and options', () => {
            const result = validateForPublish({
                id: 'tmpl-1',
                name: 'Test',
                base_price: 100,
                groups: [
                    { id: 'g1', name: 'Size', is_required: true, options_count: 3 },
                ],
                rules_count: 1,
            });
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should return error when template has no option groups', () => {
            const result = validateForPublish({
                id: 'tmpl-1',
                name: 'Test',
                base_price: 100,
                groups: [],
                rules_count: 0,
            });
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.message.includes('at least one option group'))).toBe(true);
        });

        it('should return error when required group has no options', () => {
            const result = validateForPublish({
                id: 'tmpl-1',
                name: 'Test',
                base_price: 100,
                groups: [
                    { id: 'g1', name: 'Color', is_required: true, options_count: 0 },
                ],
                rules_count: 1,
            });
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.message.includes('Color'))).toBe(true);
        });

        it('should return warning when template has no rules', () => {
            const result = validateForPublish({
                id: 'tmpl-1',
                name: 'Test',
                base_price: 100,
                groups: [
                    { id: 'g1', name: 'Size', is_required: false, options_count: 2 },
                ],
                rules_count: 0,
            });
            expect(result.isValid).toBe(true);
            expect(result.warnings.some(w => w.message.includes('no configuration rules'))).toBe(true);
        });

        it('should return autoSelections, hiddenOptions, etc. as empty for publish validation', () => {
            const result = validateForPublish({
                id: 'tmpl-1',
                name: 'Test',
                base_price: 100,
                groups: [
                    { id: 'g1', name: 'Size', is_required: false, options_count: 2 },
                ],
                rules_count: 1,
            });
            expect(result.autoSelections).toEqual({});
            expect(result.hiddenOptions).toEqual([]);
            expect(result.hiddenGroups).toEqual([]);
            expect(result.disabledOptions).toEqual([]);
        });
    });
});
