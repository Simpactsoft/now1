
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from current directory (next-web)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log('Seeding products...');

    // 1. Get a Tenant
    const { data: tenants, error: tenantError } = await supabase.from('tenants').select('id').limit(1);

    if (tenantError || !tenants?.length) {
        console.error('Error fetching tenant:', tenantError);
        // Fallback: try to insert a tenant if none exist? Or just fail.
        // Assuming at least one tenant exists from previous steps.
        return;
    }
    const tenantId = tenants[0].id;
    console.log(`Using Tenant ID: ${tenantId}`);

    // 2. Create Category
    // Upsert logic for category
    const { data: category, error: catError } = await supabase.from('product_categories')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('name', 'Electronics')
        .maybeSingle();

    let categoryId = category?.id;

    if (!categoryId) {
        const { data: newCat, error: createError } = await supabase.from('product_categories')
            .insert({
                tenant_id: tenantId,
                name: 'Electronics',
                path: 'Electronics'
            })
            .select()
            .single();

        if (createError) {
            console.error('Failed to create category:', createError);
            return;
        }
        categoryId = newCat.id;
        console.log('Created Category:', categoryId);
    } else {
        console.log('Using existing Category:', categoryId);
    }

    // 3. Seed Products
    await seedProducts(tenantId, categoryId);
}

async function seedProducts(tenantId: string, categoryId: string) {
    const products = [
        {
            tenant_id: tenantId,
            name: 'ProBook X1',
            sku: 'PB-X1-001-' + Math.floor(Math.random() * 1000),
            cost_price: 800.00,
            list_price: 1200.00,
            track_inventory: true,
            category_id: categoryId
        },
        {
            tenant_id: tenantId,
            name: 'Wireless Mouse',
            sku: 'MS-WL-002-' + Math.floor(Math.random() * 1000),
            cost_price: 15.00,
            list_price: 29.99,
            track_inventory: true,
            category_id: categoryId
        }
    ];

    const { error } = await supabase.from('products').insert(products);
    if (error) {
        console.error('Error inserting products:', error);
    } else {
        console.log('Successfully seeded products!');
    }
}

seed();
