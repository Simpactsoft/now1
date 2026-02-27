'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { ActionResult, actionSuccess, actionError } from '@/lib/action-result';

// Helper to get authenticated user client
async function getAuthClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
            },
        }
    );
}

export async function getProductsForTenant(tenantId: string): Promise<ActionResult<{ products: any[]; categories: any[] }>> {
    const authClient = await getAuthClient();
    const adminClient = createAdminClient();

    // 1. Authenticate User
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
        console.error('Server Action: Auth failed', authError);
        return actionError('Unauthorized', 'AUTH_ERROR');
    }

    console.debug(`[ServerAction] User: ${user.id} (${user.email}), Tenant: ${tenantId}`);

    // 2. Verify Membership (Security Check)
    const { data: allMembers, error: memberError } = await adminClient
        .from('tenant_members')
        .select('user_id, role')
        .eq('tenant_id', tenantId);

    if (memberError) {
        console.error('[ServerAction] Membership Query Error:', memberError);
        return actionError(`Membership Check Failed: ${memberError.message}`, 'DB_ERROR');
    }

    const membership = allMembers?.find(m => m.user_id === user.id);

    if (!membership) {
        const isServiceKeySet = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        const memberUserIds = allMembers?.map(m => m.user_id).join(', ');
        const debugMsg = `Access Denied. User: ${user.id}, Tenant: ${tenantId}, SvcKey: ${isServiceKeySet}, FoundMembers: [${memberUserIds}]`;
        console.error(`[ServerAction] ${debugMsg}`);
        return actionError(debugMsg, 'AUTH_ERROR');
    }

    // 3. Fetch Products (Bypass RLS)
    const { data: products, error: prodError } = await adminClient
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId);

    if (prodError) return actionError(prodError.message, 'DB_ERROR');

    // 4. Fetch Inventory Stock
    const productIds = products.map(p => p.id);
    let stockMap: Record<string, number> = {};

    if (productIds.length > 0) {
        const { data: ledgerData, error: ledgerError } = await adminClient
            .from('inventory_ledger')
            .select('product_id, quantity_change')
            .in('product_id', productIds);

        if (!ledgerError && ledgerData) {
            ledgerData.forEach((row: any) => {
                stockMap[row.product_id] = (stockMap[row.product_id] || 0) + row.quantity_change;
            });
        }
    }

    // 5. Fetch Categories
    const { data: categories } = await adminClient
        .from('product_categories')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('path');

    // =========================================================================
    // 6. PRICE ENRICHMENT — compute real prices from BOM & CPQ
    // =========================================================================

    // 6a. BOM Costs — find which products have BOMs and compute their costs
    let bomCostMap: Record<string, number> = {};
    if (productIds.length > 0) {
        const { data: bomHeaders } = await adminClient
            .from('bom_headers')
            .select('id, product_id')
            .in('product_id', productIds)
            .eq('status', 'ACTIVE');

        if (bomHeaders && bomHeaders.length > 0) {
            // Compute BOM cost for each product that has one
            const bomCostPromises = bomHeaders.map(async (bh: any) => {
                try {
                    const { data: cost } = await adminClient
                        .rpc('calculate_bom_cost', {
                            p_product_id: bh.product_id,
                            p_version: '1.0'
                        });
                    if (cost != null && cost > 0) {
                        bomCostMap[bh.product_id] = cost;
                    }
                } catch (e) {
                    console.warn(`[PriceEnrich] BOM cost failed for ${bh.product_id}:`, e);
                }
            });
            await Promise.all(bomCostPromises);
            console.debug(`[PriceEnrich] BOM costs computed for ${Object.keys(bomCostMap).length} products`);
        }
    }

    // 6b. CPQ Template Prices — for configurable products
    let templatePriceMap: Record<string, number> = {};
    const configurableProducts = products.filter(p => p.is_configurable && p.template_id);
    if (configurableProducts.length > 0) {
        const templateIds = [...new Set(configurableProducts.map(p => p.template_id))];
        const { data: templates } = await adminClient
            .from('product_templates')
            .select('id, base_price')
            .in('id', templateIds);

        if (templates) {
            templates.forEach((t: any) => {
                if (t.base_price > 0) {
                    templatePriceMap[t.id] = t.base_price;
                }
            });
        }
        console.debug(`[PriceEnrich] CPQ template prices for ${Object.keys(templatePriceMap).length} templates`);
    }

    // 7. Build enriched product list with effective prices
    const enrichedProducts = products.map(p => {
        let effectiveCostPrice = p.cost_price || 0;
        let effectiveListPrice = p.list_price || 0;
        let priceSource = 'manual'; // track where price came from

        // Priority 1: BOM cost (most accurate for assembled products)
        if (bomCostMap[p.id]) {
            effectiveCostPrice = bomCostMap[p.id];
            priceSource = 'bom';
            // If no list_price set, derive from BOM cost with markup
            if (effectiveListPrice === 0) {
                effectiveListPrice = effectiveCostPrice * 1.3; // 30% margin default
            }
        }

        // Priority 2: CPQ template base_price (for configurable products)
        if (p.is_configurable && p.template_id && templatePriceMap[p.template_id]) {
            const templatePrice = templatePriceMap[p.template_id];
            priceSource = 'cpq';
            if (effectiveListPrice === 0) {
                effectiveListPrice = templatePrice;
            }
            if (effectiveCostPrice === 0) {
                effectiveCostPrice = templatePrice;
            }
        }

        // Priority 3: Fallback — if cost is set but list isn't
        if (effectiveListPrice === 0 && effectiveCostPrice > 0) {
            effectiveListPrice = effectiveCostPrice * 1.3;
        }

        return {
            ...p,
            cost_price: effectiveCostPrice,
            list_price: effectiveListPrice,
            price_source: priceSource,
            current_stock: stockMap[p.id] || 0
        };
    });

    return actionSuccess({
        products: enrichedProducts,
        categories: categories || []
    });
}

