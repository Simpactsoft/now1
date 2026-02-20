'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAuthWithTenant } from './_shared/auth';
import { isAuthError } from './_shared/auth-utils';
import { ActionResult, actionSuccess, actionError } from '@/lib/action-result';
import { saveQuoteSchema, validateSchema } from './_shared/schemas';
import { generateBomForConfiguration } from '@/app/actions/cpq/bom-generation-actions';

export interface SaveQuoteInput {
    existingQuoteId?: string;  // If set, UPDATE instead of INSERT
    tenantId: string;
    quoteNumber: string;
    customerId: string;
    customerName: string;
    currency: string;
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    grandTotal: number;
    totalCost: number;
    marginPct: number;
    items: SaveQuoteItemInput[];
}

export interface SaveQuoteItemInput {
    productId?: string | null;
    sku: string;
    name: string;
    unitPrice: number;
    quantity: number;
    discountPercent: number;
    lineTotal: number;
    unitCost: number;
    costSource: string;
    configurationId?: string | null;
}

export async function saveQuote(rawInput: SaveQuoteInput): Promise<ActionResult<{ quoteId: string, publicToken?: string }>> {
    try {
        // 1. Zod Validation
        const validation = validateSchema(saveQuoteSchema, rawInput);
        if (!validation.success) {
            console.error('[saveQuote] Validation failed:', validation.error);
            return actionError(validation.error, 'VALIDATION_ERROR');
        }
        const input = validation.data;

        // 2. Auth & Membership check (Pattern B)
        const auth = await verifyAuthWithTenant(input.tenantId);
        if (isAuthError(auth)) {
            console.error('[saveQuote] Auth failed:', auth.error);
            return actionError(auth.error, 'AUTH_ERROR');
        }
        const { userId } = auth; // verified user id

        const adminClient = createAdminClient();

        // 3. INSERT or UPDATE quote
        let quoteId: string;
        let publicToken: string | undefined;

        if (input.existingQuoteId) {
            // UPDATE existing quote
            const { data: updated, error: updateError } = await adminClient
                .from('quotes')
                .update({
                    customer_id: input.customerId,
                    customer_name: input.customerName,
                    currency: input.currency,
                    subtotal: input.subtotal,
                    discount_total: input.discountTotal,
                    tax_total: input.taxTotal,
                    grand_total: input.grandTotal,
                    recurring_total_monthly: input.recurringTotalMonthly,
                    recurring_total_yearly: input.recurringTotalYearly,
                    total_cost: input.totalCost,
                    margin_pct: input.marginPct,
                    notes: input.notes,
                })
                .eq('id', input.existingQuoteId)
                .eq('tenant_id', input.tenantId) // Ensure tenant isolation
                .select('id, public_token')
                .single();

            if (updateError) {
                console.error('[saveQuote] Quote update error:', updateError);
                return actionError(updateError.message, 'DB_ERROR');
            }
            if (!updated) {
                return actionError('Quote not found or access denied', 'NOT_FOUND');
            }
            quoteId = updated.id;
            publicToken = updated.public_token;

            // Delete old items, then re-insert
            await adminClient.from('quote_items').delete().eq('quote_id', quoteId).eq('tenant_id', input.tenantId);

        } else {
            // INSERT new quote
            const { data: quote, error: quoteError } = await adminClient
                .from('quotes')
                .insert({
                    tenant_id: input.tenantId,
                    quote_number: input.quoteNumber,
                    status: 'draft',
                    customer_id: input.customerId,
                    customer_name: input.customerName,
                    currency: input.currency,
                    subtotal: input.subtotal,
                    discount_total: input.discountTotal,
                    tax_total: input.taxTotal,
                    grand_total: input.grandTotal,
                    recurring_total_monthly: input.recurringTotalMonthly,
                    recurring_total_yearly: input.recurringTotalYearly,
                    total_cost: input.totalCost,
                    margin_pct: input.marginPct,
                    notes: input.notes,
                    created_by: userId,
                })
                .select('id, public_token')
                .single();

            if (quoteError) {
                console.error('[saveQuote] Quote insert error:', quoteError);
                return actionError(quoteError.message, 'DB_ERROR');
            }
            quoteId = quote.id;
            publicToken = quote.public_token;
        }

        // 4. Insert quote items
        let itemsToInsert: any[] = [];
        if (input.items.length > 0) {
            itemsToInsert = input.items.map((item, index) => ({
                tenant_id: input.tenantId,
                quote_id: quoteId,
                line_number: index + 1,
                product_id: item.productId || null,
                sku: item.sku,
                description: item.name,
                unit_price: item.unitPrice,
                quantity: item.quantity,
                discount_percent: item.discountPercent,
                line_total: item.lineTotal,
                unit_cost: item.unitCost,
                cost_source: item.costSource,
                configuration_id: item.configurationId || null,
                is_recurring: item.isRecurring,
                billing_frequency: item.billingFrequency,
            }));

            const { error: itemsError } = await adminClient
                .from('quote_items')
                .insert(itemsToInsert);

            if (itemsError) {
                console.error('[saveQuote] Items insert error:', itemsError);
                if (!input.existingQuoteId) {
                    // Clean up the orphaned quote only on new inserts
                    await adminClient.from('quotes').delete().eq('id', quoteId);
                }
                return actionError(itemsError.message, 'DB_ERROR');
            }

            // 5. Generate BOM processing for any CPQ configured items
            for (const item of itemsToInsert) {
                if (item.configuration_id) {
                    try {
                        const bomResult = await generateBomForConfiguration({
                            configurationId: item.configuration_id,
                            quoteItemId: "TBD", // we don't strictly need a direct link right now as they link via product_id
                            tenantId: input.tenantId
                        });
                        console.log(`[saveQuote] Generated BOM for CPQ Config ${item.configuration_id}`);

                        // Link the generated product to the quote item
                        if (bomResult.success && bomResult.productId) {
                            await adminClient.from('quote_items')
                                .update({ product_id: bomResult.productId })
                                .eq('quote_id', quoteId)
                                .eq('line_number', item.line_number)
                                .eq('tenant_id', input.tenantId);
                        }
                    } catch (bomErr) {
                        console.error('[saveQuote] Error generating BOM:', bomErr);
                        // Do not fail the whole quote save if BOM generation fails
                    }
                }
            }
        }

        console.log(`[saveQuote] ${input.existingQuoteId ? 'Updated' : 'Created'}: ${quoteId} (${input.quoteNumber}), ${input.items.length} items, by ${userId}`);
        return actionSuccess({ quoteId, publicToken });

    } catch (err: any) {
        console.error('[saveQuote] Unexpected error:', err);
        return actionError(err.message || 'Unknown error', 'UNKNOWN');
    }
}
