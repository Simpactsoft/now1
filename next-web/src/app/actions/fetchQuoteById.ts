'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAuthWithTenant } from './_shared/auth';
import { isAuthError } from './_shared/auth-utils';
import { ActionResult, actionSuccess, actionError } from '@/lib/action-result';
import { uuidSchema } from './_shared/schemas';

export interface QuoteDetail {
    id: string;
    tenant_id: string;
    quote_number: string;
    status: string;
    customer_id: string | null;
    customer_name: string | null;
    currency: string;
    subtotal: number;
    discount_total: number;
    tax_total: number;
    grand_total: number;
    recurring_total_monthly?: number;
    recurring_total_yearly?: number;
    total_cost: number;
    margin_pct: number | null;
    notes: string | null;
    quote_date: string;
    valid_until: string | null;
    created_at: string;
    items: QuoteItemDetail[];
    public_token?: string;
}

export interface QuoteItemDetail {
    id: string;
    product_id: string;
    sku: string | null;
    description: string | null;
    unit_price: number;
    quantity: number;
    discount_percent: number;
    line_total: number;
    unit_cost: number;
    cost_source: string | null;
    configuration_id: string | null;
    is_recurring?: boolean;
    billing_frequency?: string | null;
    line_number: number;
}

export async function fetchQuoteById(quoteId: string): Promise<ActionResult<QuoteDetail>> {
    try {
        // 1. Zod Validation
        const parsedQuoteId = uuidSchema.safeParse(quoteId);
        if (!parsedQuoteId.success) {
            return actionError('Invalid Quote ID format', 'VALIDATION_ERROR');
        }

        const adminClient = createAdminClient();

        // 2. Fetch quote (need tenant_id first to authorize)
        const { data: quote, error: quoteError } = await adminClient
            .from('quotes')
            .select('*')
            .eq('id', parsedQuoteId.data)
            .single();

        if (quoteError || !quote) {
            console.error('[fetchQuoteById] Error:', quoteError);
            return actionError(quoteError?.message || 'Quote not found', 'NOT_FOUND');
        }

        // 3. Auth & Membership check (Pattern B)
        const auth = await verifyAuthWithTenant(quote.tenant_id);
        if (isAuthError(auth)) {
            return actionError(auth.error, 'AUTH_ERROR');
        }

        // 4. Fetch quote items
        const { data: items, error: itemsError } = await adminClient
            .from('quote_items')
            .select('*')
            .eq('quote_id', parsedQuoteId.data)
            .order('line_number', { ascending: true });

        if (itemsError) {
            console.error('[fetchQuoteById] Items error:', itemsError);
        }

        const result: QuoteDetail = {
            id: quote.id,
            tenant_id: quote.tenant_id,
            quote_number: quote.quote_number,
            status: quote.status,
            customer_id: quote.customer_id,
            customer_name: quote.customer_name,
            currency: quote.currency || 'ILS',
            subtotal: quote.subtotal || 0,
            discount_total: quote.discount_total || 0,
            tax_total: quote.tax_total || 0,
            grand_total: quote.grand_total || 0,
            recurring_total_monthly: quote.recurring_total_monthly || 0,
            recurring_total_yearly: quote.recurring_total_yearly || 0,
            total_cost: quote.total_cost || 0,
            margin_pct: quote.margin_pct,
            notes: quote.notes,
            quote_date: quote.quote_date,
            valid_until: quote.valid_until,
            created_at: quote.created_at,
            items: (items || []).map(i => ({
                id: i.id,
                product_id: i.product_id,
                sku: i.sku,
                description: i.description,
                unit_price: i.unit_price,
                quantity: i.quantity,
                discount_percent: i.discount_percent || 0,
                line_total: i.line_total,
                unit_cost: i.unit_cost || 0,
                cost_source: i.cost_source,
                configuration_id: i.configuration_id,
                is_recurring: i.is_recurring,
                billing_frequency: i.billing_frequency,
                line_number: i.line_number,
            })),
            public_token: quote.public_token,
        };

        return actionSuccess(result);
    } catch (err: any) {
        console.error('[fetchQuoteById] Unexpected:', err);
        return actionError(err.message || 'Unknown error', 'UNKNOWN');
    }
}
