'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAuthWithTenant } from './_shared/auth';
import { isAuthError } from './_shared/auth-utils';
import { GridResult } from '@/lib/action-result';
import { uuidSchema } from './_shared/schemas';

export interface QuoteSummary {
    id: string;
    quote_number: string;
    status: string;
    grand_total: number;
    currency: string;
    customer_id: string | null;
    customer_name: string | null;
    margin_pct: number | null;
    items_count: number;
    quote_date: string;
    valid_until: string | null;
    created_at: string;
    updated_at: string;
}

export async function fetchQuotes(tenantId: string): Promise<GridResult<QuoteSummary>> {
    const t0 = Date.now();
    try {
        // 1. Zod Validation
        const parsedTenantId = uuidSchema.safeParse(tenantId);
        if (!parsedTenantId.success) {
            return { rowData: [], rowCount: 0, error: 'Invalid tenant ID', latency: Date.now() - t0 };
        }

        // 2. Auth & Membership check (Pattern B)
        const auth = await verifyAuthWithTenant(parsedTenantId.data);
        if (isAuthError(auth)) {
            return { rowData: [], rowCount: 0, error: auth.error, latency: Date.now() - t0 };
        }

        const adminClient = createAdminClient();

        // 3. Fetch quotes from the quotes table
        const { data: quotes, error: quotesError } = await adminClient
            .from('quotes')
            .select('*')
            .eq('tenant_id', parsedTenantId.data)
            .order('created_at', { ascending: false });

        if (quotesError) {
            console.error('[fetchQuotes] Error:', quotesError);
            return { rowData: [], rowCount: 0, error: quotesError.message, latency: Date.now() - t0 };
        }

        if (!quotes || quotes.length === 0) {
            return { rowData: [], rowCount: 0, latency: Date.now() - t0 };
        }

        // 4. Fetch item counts per quote
        const quoteIds = quotes.map(q => q.id);
        let itemCountMap: Record<string, number> = {};

        if (quoteIds.length > 0) {
            const { data: items } = await adminClient
                .from('quote_items')
                .select('quote_id')
                .in('quote_id', quoteIds);

            if (items) {
                items.forEach((item: any) => {
                    itemCountMap[item.quote_id] = (itemCountMap[item.quote_id] || 0) + 1;
                });
            }
        }

        // 5. Build result
        const result: QuoteSummary[] = quotes.map(q => ({
            id: q.id,
            quote_number: q.quote_number,
            status: q.status,
            grand_total: q.grand_total || 0,
            currency: q.currency || 'ILS', // Default to ILS if not set
            customer_id: q.customer_id,
            customer_name: q.customer_name || null,
            margin_pct: q.margin_pct,
            items_count: itemCountMap[q.id] || 0,
            quote_date: q.quote_date,
            valid_until: q.valid_until,
            created_at: q.created_at,
            updated_at: q.updated_at,
        }));

        return { rowData: result, rowCount: result.length, latency: Date.now() - t0 };
    } catch (err: any) {
        console.error('[fetchQuotes] Unexpected error:', err);
        return { rowData: [], rowCount: 0, error: err.message, latency: Date.now() - t0 };
    }
}
