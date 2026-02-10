
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { Product } from "@/types/product";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await req.json();

        const {
            filters = [],
            searchQuery = '',
            sorting = [],
            pagination = { page: 1, pageSize: 50 },
            tenantId
        } = body;

        if (!tenantId) {
            return NextResponse.json({ error: "Missing Tenant ID" }, { status: 400 });
        }

        console.log('[API/Products] Request:', { tenantId, searchQuery, filters: filters.length, page: pagination.page });

        // DEBUG: Test if we can fetch ANY products at all
        const { data: testData, error: testError } = await supabase
            .from('products')
            .select('id, name, sku, tenant_id')
            .limit(5);

        console.log('[API/Products] TEST QUERY - All products (limit 5):', testData?.length || 0);
        console.log('[API/Products] TEST QUERY - First product:', testData?.[0]);
        console.log('[API/Products] TEST QUERY - Error:', testError);

        // 1. Build Query (WITHOUT view join - we'll fetch stock separately)
        let query = supabase
            .from('products')
            .select(`
                *,
                product_categories(name)
            `, { count: 'exact' })
            .eq('tenant_id', tenantId);

        // 2. Global Search (Name or SKU)
        if (searchQuery) {
            query = query.or(`name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%`);
        }

        // 3. Filters
        filters.forEach((f: any) => {
            if (!f.isEnabled) return;

            if (f.field === 'category_id' && f.value) {
                const val = Array.isArray(f.value) ? f.value : [f.value];
                query = query.in('category_id', val);
            }
            if (f.field === 'status' && f.value) {
                const val = Array.isArray(f.value) ? f.value : [f.value];
                query = query.in('status', val);
            }
        });

        // 4. Sorting
        if (sorting && sorting.length > 0) {
            const { colId, sort } = sorting[0];
            // Safe sort columns
            if (['name', 'sku', 'list_price', 'created_at', 'status'].includes(colId)) {
                query = query.order(colId, { ascending: sort === 'asc' });
            } else {
                query = query.order('created_at', { ascending: false });
            }
        } else {
            query = query.order('created_at', { ascending: false });
        }

        // 5. Pagination
        const page = pagination.page || 1;
        const pageSize = pagination.pageSize || 50;
        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;

        query = query.range(start, end);

        // 6. Execute Query
        const { data: products, count, error } = await query;

        if (error) {
            console.error("[API/Products] Query Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log('[API/Products] ===== QUERY RESULTS =====');
        console.log('[API/Products] Products fetched:', products?.length || 0);
        console.log('[API/Products] Total count:', count);
        console.log('[API/Products] First product:', products?.[0] ? { id: products[0].id, name: products[0].name, sku: products[0].sku } : 'NONE');
        console.log('[API/Products] ========================');

        // 7. Fetch Stock from View (for the products we got)
        let stockMap: Record<string, number> = {};
        if (products && products.length > 0) {
            const productIds = products.map((p: any) => p.id);

            // Query the view directly
            const { data: stockData, error: stockError } = await supabase
                .from('product_stock_view')
                .select('product_id, stock_quantity')
                .in('product_id', productIds);

            if (stockError) {
                console.error('[API/Products] Stock view error:', stockError);
                // Continue without stock data
            } else if (stockData) {
                stockData.forEach((item: any) => {
                    stockMap[item.product_id] = item.stock_quantity || 0;
                });
                console.log('[API/Products] Stock data loaded for', Object.keys(stockMap).length, 'products');
            }
        }

        // 8. Map Data
        const finalData: Product[] = (products || []).map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            description: p.description,
            category_id: p.category_id,
            list_price: Number(p.list_price),
            cost_price: Number(p.cost_price),
            track_inventory: p.track_inventory,
            min_stock: p.min_stock,
            status: p.status || 'ACTIVE',
            image_url: p.image_url,
            unit: p.unit,
            barcode: p.barcode,
            tags: p.tags,
            created_at: p.created_at,
            updated_at: p.updated_at,

            // Computed/Joined
            stock_quantity: stockMap[p.id] || 0,
            category_name: p.product_categories?.name
        }));

        console.log('[API/Products] Returning', finalData.length, 'products');

        return NextResponse.json({
            data: finalData,
            totalRecords: count || 0,
            totalPages: Math.ceil((count || 0) / pageSize),
            page,
            pageSize
        });

    } catch (e: any) {
        console.error("[API/Products] Critical Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
