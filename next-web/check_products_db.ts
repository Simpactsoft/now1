import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use service role for admin bypass

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProducts() {
    console.log('--- Checking Configurable Products ---');
    const { data: configurableProducts, error: confError } = await supabase
        .from('products')
        .select('*')
        .eq('is_configurable', true);

    if (confError) {
        console.error('Error fetching configurable products:', confError);
    } else {
        console.log(`Found ${configurableProducts.length} configurable products.`);
        configurableProducts.forEach(p => {
            console.log(`- ${p.name} (ID: ${p.id}, Template: ${p.template_id}, Tenant: ${p.tenant_id})`);
        });
    }

    console.log('\n--- Checking All Templates ---');
    const { data: templates, error: tempError } = await supabase
        .from('product_templates')
        .select('id, template_name');

    if (tempError) {
        console.error('Error fetching templates:', tempError);
    } else {
        console.log(`Found ${templates.length} templates.`);
        templates.forEach(t => {
            console.log(`- ${t.template_name} (ID: ${t.id})`);
        });
    }
}

checkProducts();
