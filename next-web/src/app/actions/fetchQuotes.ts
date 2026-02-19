'use server';

import { createClient } from '@/lib/supabase/server';
import { GridResult } from '@/lib/action-result';

export interface QuoteSummary {
    id: string;
    order_number: number;
    status: string;
    order_type: string;
    total_amount: number;
    currency: string;
    customer_id: string | null;
    customer_name: string | null;
    items_count: number;
    created_at: string;
    updated_at: string;
}

export async function fetchQuotes(tenantId: string): Promise<GridResult<QuoteSummary>> {
    const t0 = Date.now();
    try {
        const supabase = await createClient();

        // Fetch quotes (orders with order_type = 'quote')
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('order_type', 'quote')
            .order('created_at', { ascending: false });

        if (ordersError) {
            console.error('[fetchQuotes] Error:', ordersError);
            return { rowData: [], rowCount: 0, error: ordersError.message, latency: Date.now() - t0 };
        }

        if (!orders || orders.length === 0) {
            return { rowData: [], rowCount: 0, latency: Date.now() - t0 };
        }

        // Fetch customer names
        const customerIds = [...new Set(orders.filter(o => o.customer_id).map(o => o.customer_id))];
        let customerMap: Record<string, string> = {};

        if (customerIds.length > 0) {
            const { data: customers } = await supabase
                .from('cards')
                .select('id, display_name')
                .in('id', customerIds);

            if (customers) {
                customers.forEach((c: any) => {
                    customerMap[c.id] = c.display_name || 'Unknown';
                });
            }
        }

        // Fetch item counts per order
        const orderIds = orders.map(o => o.id);
        let itemCountMap: Record<string, number> = {};

        if (orderIds.length > 0) {
            const { data: items } = await supabase
                .from('order_items')
                .select('order_id')
                .in('order_id', orderIds);

            if (items) {
                items.forEach((item: any) => {
                    itemCountMap[item.order_id] = (itemCountMap[item.order_id] || 0) + 1;
                });
            }
        }

        // Combine
        const quotes: QuoteSummary[] = orders.map(o => ({
            id: o.id,
            order_number: o.order_number,
            status: o.status,
            order_type: o.order_type || 'quote',
            total_amount: o.total_amount || 0,
            currency: o.currency || 'ILS',
            customer_id: o.customer_id,
            customer_name: o.customer_id ? (customerMap[o.customer_id] || 'Unknown') : null,
            items_count: itemCountMap[o.id] || 0,
            created_at: o.created_at,
            updated_at: o.updated_at,
        }));

        return { rowData: quotes, rowCount: quotes.length, latency: Date.now() - t0 };
    } catch (err: any) {
        console.error('[fetchQuotes] Unexpected error:', err);
        return { rowData: [], rowCount: 0, error: err.message, latency: Date.now() - t0 };
    }
}
