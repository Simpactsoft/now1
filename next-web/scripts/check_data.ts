
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkData() {
    console.log('--- Checking Tenants ---');
    const { data: tenants } = await supabase.from('tenants').select('id, name');
    console.log(tenants);

    console.log('\n--- Checking Products ---');
    const { data: products } = await supabase.from('products').select('id, name, tenant_id');
    console.log(products);

    console.log('\n--- Checking Categories ---');
    const { data: categories } = await supabase.from('product_categories').select('id, name, tenant_id');
    console.log(categories);
}

checkData();
