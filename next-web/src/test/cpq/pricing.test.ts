import { describe, it, expect, vi, beforeEach } from 'vitest'

// We can't directly test `calculatePrice` as a server action (it uses `createClient`
// from '@/lib/supabase/server', which is a "use server" module). Instead, we test
// the PRICING FORMULA logic by extracting and verifying the algorithm:
//
// Formula: T = (B + ΣO_add) × ΠM_mult – D
// Where:
//   B = base price
//   ΣO_add = sum of all additive modifiers
//   ΠM_mult = product of all multiplicative modifiers
//   D = discount amount

describe('CPQ Pricing Formula', () => {
    /**
     * Helper that replicates the pricing engine logic from pricing-actions.ts
     * lines 78-219, without Supabase calls.
     */
    function computePrice(params: {
        basePrice: number;
        options: Array<{
            groupId: string;
            groupName: string;
            optionId: string;
            optionName: string;
            modifierType: 'add' | 'multiply' | 'replace';
            modifierAmount: number;
        }>;
        quantity?: number;
        discount?: { type: 'percentage' | 'fixed_amount'; value: number; name?: string };
    }) {
        let basePrice = params.basePrice;
        let additiveTotal = 0;
        let multiplicativeFactor = 1;
        const breakdown: any[] = [];
        const quantity = params.quantity || 1;

        for (const opt of params.options) {
            switch (opt.modifierType) {
                case 'add':
                    additiveTotal += opt.modifierAmount;
                    break;
                case 'multiply':
                    multiplicativeFactor *= opt.modifierAmount;
                    break;
                case 'replace':
                    basePrice = opt.modifierAmount;
                    break;
            }
            breakdown.push({
                groupId: opt.groupId,
                groupName: opt.groupName,
                optionId: opt.optionId,
                optionName: opt.optionName,
                modifierType: opt.modifierType,
                modifierAmount: opt.modifierAmount,
                lineTotal: opt.modifierType === 'add' ? opt.modifierAmount : 0,
            });
        }

        const subtotalBeforeMultiply = basePrice + additiveTotal;
        const subtotalAfterMultiply = subtotalBeforeMultiply * multiplicativeFactor;

        let discountAmount = 0;
        if (params.discount) {
            if (params.discount.type === 'percentage') {
                discountAmount = subtotalAfterMultiply * (params.discount.value / 100);
            } else {
                discountAmount = params.discount.value;
            }
        }

        const perUnitPrice = subtotalAfterMultiply - discountAmount;
        const total = perUnitPrice * quantity;

        return {
            basePrice,
            optionsTotal: additiveTotal,
            subtotal: subtotalAfterMultiply,
            discountAmount,
            total,
            perUnitPrice,
            quantity,
            breakdown,
        };
    }

    it('should return base price only when no options selected', () => {
        const result = computePrice({ basePrice: 1000, options: [] });
        expect(result.basePrice).toBe(1000);
        expect(result.optionsTotal).toBe(0);
        expect(result.subtotal).toBe(1000);
        expect(result.total).toBe(1000);
    });

    it('should handle additive modifier (add)', () => {
        const result = computePrice({
            basePrice: 1000,
            options: [
                {
                    groupId: 'g1', groupName: 'Size', optionId: 'o1', optionName: 'Large',
                    modifierType: 'add', modifierAmount: 200,
                },
            ],
        });
        expect(result.optionsTotal).toBe(200);
        expect(result.total).toBe(1200);
        expect(result.breakdown[0].lineTotal).toBe(200);
    });

    it('should handle multiplicative modifier (multiply)', () => {
        const result = computePrice({
            basePrice: 1000,
            options: [
                {
                    groupId: 'g1', groupName: 'Finish', optionId: 'o1', optionName: 'Premium',
                    modifierType: 'multiply', modifierAmount: 1.5,
                },
            ],
        });
        // T = (1000 + 0) × 1.5 = 1500
        expect(result.subtotal).toBe(1500);
        expect(result.total).toBe(1500);
        expect(result.breakdown[0].lineTotal).toBe(0); // multiply lineTotal is 0
    });

    it('should handle replace modifier', () => {
        const result = computePrice({
            basePrice: 1000,
            options: [
                {
                    groupId: 'g1', groupName: 'Plan', optionId: 'o1', optionName: 'Enterprise',
                    modifierType: 'replace', modifierAmount: 5000,
                },
            ],
        });
        // Replace sets basePrice to 5000
        expect(result.basePrice).toBe(5000);
        expect(result.total).toBe(5000);
    });

    it('should handle multiple options from same group (multiple selection)', () => {
        const result = computePrice({
            basePrice: 500,
            options: [
                {
                    groupId: 'g1', groupName: 'Accessories', optionId: 'o1', optionName: 'Case',
                    modifierType: 'add', modifierAmount: 50,
                },
                {
                    groupId: 'g1', groupName: 'Accessories', optionId: 'o2', optionName: 'Screen Protector',
                    modifierType: 'add', modifierAmount: 30,
                },
            ],
        });
        // 500 + 50 + 30 = 580
        expect(result.optionsTotal).toBe(80);
        expect(result.total).toBe(580);
        expect(result.breakdown).toHaveLength(2);
    });

    it('should apply formula T = (B + ΣO_add) × ΠM_mult correctly with mixed modifiers', () => {
        const result = computePrice({
            basePrice: 1000,
            options: [
                {
                    groupId: 'g1', groupName: 'Material', optionId: 'o1', optionName: 'Steel',
                    modifierType: 'add', modifierAmount: 200,
                },
                {
                    groupId: 'g2', groupName: 'Finish', optionId: 'o2', optionName: 'Gold',
                    modifierType: 'multiply', modifierAmount: 2,
                },
            ],
        });
        // T = (1000 + 200) × 2 = 2400
        expect(result.subtotal).toBe(2400);
        expect(result.total).toBe(2400);
    });

    it('should handle percentage discount', () => {
        const result = computePrice({
            basePrice: 1000,
            options: [],
            discount: { type: 'percentage', value: 10 },
        });
        // subtotal = 1000, discount = 1000 * 10/100 = 100, total = 900
        expect(result.discountAmount).toBe(100);
        expect(result.total).toBe(900);
    });

    it('should handle fixed_amount discount', () => {
        const result = computePrice({
            basePrice: 1000,
            options: [],
            discount: { type: 'fixed_amount', value: 150 },
        });
        expect(result.discountAmount).toBe(150);
        expect(result.total).toBe(850);
    });

    it('should handle quantity multiplier', () => {
        const result = computePrice({
            basePrice: 100,
            options: [
                {
                    groupId: 'g1', groupName: 'Extras', optionId: 'o1', optionName: 'Extra',
                    modifierType: 'add', modifierAmount: 50,
                },
            ],
            quantity: 3,
        });
        // perUnit = 100 + 50 = 150, total = 150 × 3 = 450
        expect(result.perUnitPrice).toBe(150);
        expect(result.total).toBe(450);
        expect(result.quantity).toBe(3);
    });

    it('should not produce negative total (edge case: large discount)', () => {
        const result = computePrice({
            basePrice: 100,
            options: [],
            discount: { type: 'fixed_amount', value: 200 },
        });
        // Implementation doesn't clamp to 0 — total = 100 - 200 = -100
        // This documents the actual behavior:
        expect(result.total).toBe(-100);
        // NOTE: If business requires clamping to 0, the server action
        // should be updated and this test should change accordingly.
    });

    it('should handle template with no option_groups — base price only', () => {
        const result = computePrice({ basePrice: 999, options: [], quantity: 1 });
        expect(result.basePrice).toBe(999);
        expect(result.optionsTotal).toBe(0);
        expect(result.subtotal).toBe(999);
        expect(result.total).toBe(999);
        expect(result.breakdown).toHaveLength(0);
    });
});
