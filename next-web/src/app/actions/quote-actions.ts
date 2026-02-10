
'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

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

// Helper to get admin client (Service Role)
function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
}

export async function getProductsForTenant(tenantId: string) {
    const authClient = await getAuthClient();
    const adminClient = getAdminClient();

    // 1. Authenticate User
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
        console.error('Server Action: Auth failed', authError);
        throw new Error('Unauthorized');
    }

    console.log(`[ServerAction] User: ${user.id} (${user.email}), Tenant: ${tenantId}`);

    // 2. Verify Membership (Security Check)
    console.log(`[ServerAction] Checking membership for User ${user.id} in Tenant ${tenantId}`);

    // Fetch ALL members for this tenant (to debug visibility)
    const { data: allMembers, error: memberError } = await adminClient
        .from('tenant_members')
        .select('user_id, role')
        .eq('tenant_id', tenantId);

    if (memberError) {
        console.error('[ServerAction] Membership Query Error:', memberError);
        throw new Error(`Membership Check Failed: ${memberError.message}`);
    }

    // In-memory check
    const membership = allMembers?.find(m => m.user_id === user.id);

    if (!membership) {
        const isServiceKeySet = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        const memberUserIds = allMembers?.map(m => m.user_id).join(', ');

        const debugMsg = `Access Denied. User: ${user.id}, Tenant: ${tenantId}, SvcKey: ${isServiceKeySet}, FoundMembers: [${memberUserIds}]`;
        console.error(`[ServerAction] ${debugMsg}`);

        throw new Error(debugMsg);
    }

    console.log('[ServerAction] Membership verified:', membership);

    // 3. Fetch Products (Bypass RLS)
    const { data: products, error: prodError } = await adminClient
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId);

    if (prodError) throw prodError;

    // 4. Fetch Inventory Ledger (Bypass RLS)
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

    // Return combined data
    return {
        products: products.map(p => ({
            ...p,
            current_stock: stockMap[p.id] || 0
        })),
        categories: categories || []
    };
}
