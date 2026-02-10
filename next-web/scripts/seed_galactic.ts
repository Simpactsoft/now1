
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

const TARGET_TENANT_ID = '00000000-0000-0000-0000-000000000003'; // Galactic Stress Test

async function seed() {
    console.log(`Seeding products for Galactic Stress Test (${TARGET_TENANT_ID})...`);

    // 1. Verify Tenant Exists
    const { data: tenant, error: tenantError } = await supabase.from('tenants').select('id, name').eq('id', TARGET_TENANT_ID).single();

    if (tenantError || !tenant) {
        console.error('Error fetching tenant:', tenantError);
        return;
    }
    console.log(`Confirmed Tenant: ${tenant.name}`);

    // 2. Create Categories
    const categories = ['Electronics', 'Office Supplies', 'Services'];
    const categoryIds: Record<string, string> = {};

    for (const catName of categories) {
        // Upsert logic
        let { data: cat } = await supabase.from('product_categories')
            .select('id')
            .eq('tenant_id', TARGET_TENANT_ID)
            .eq('name', catName)
            .maybeSingle();

        if (!cat) {
            const { data: newCat, error } = await supabase.from('product_categories')
                .insert({
                    tenant_id: TARGET_TENANT_ID,
                    name: catName,
                    path: catName
                })
                .select()
                .single();
            if (error) {
                console.error(`Failed to create category ${catName}:`, error.message);
                continue;
            }
            cat = newCat;
        }
        if (cat) categoryIds[catName] = cat.id;
    }

    // 3. Seed Products
    if (!categoryIds['Electronics']) {
        console.error('Skipping product seed: Missing Electronics category');
        return;
    }

    const products = [
        {
            tenant_id: TARGET_TENANT_ID,
            name: 'Galactic Server Rack',
            sku: 'GL-SR-9000',
            cost_price: 5000.00,
            list_price: 8500.00,
            track_inventory: true,
            category_id: categoryIds['Electronics']
        },
        {
            tenant_id: TARGET_TENANT_ID,
            name: 'Quantum Processor Unit',
            sku: 'QPU-X1',
            cost_price: 1200.00,
            list_price: 2400.00,
            track_inventory: true,
            category_id: categoryIds['Electronics']
        },
        {
            tenant_id: TARGET_TENANT_ID,
            name: 'Consulting Hour',
            sku: 'SVC-CONS',
            cost_price: 0.00,
            list_price: 150.00,
            track_inventory: false,
            category_id: categoryIds['Services'] || categoryIds['Electronics']
        }
    ];

    for (const p of products) {
        const { error } = await supabase.from('products').insert(p);
        if (error) {
            console.error(`Error inserting product ${p.name}:`, error.message);
        } else {
            console.log(`Seeded: ${p.name}`);
        }
    }

    console.log('Seeding complete for Galactic Stress Test.');
}

seed();
