const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCrossTenant() {
    console.log("Checking products...");
    const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id, name, tenant_id')
        .ilike('name', '%Light Aircraft%');

    if (prodErr || !products?.length) {
        console.log("Product not found:", prodErr);
        return;
    }

    for (const product of products) {
        console.log(`\nProduct: ${product.name} | ID: ${product.id} | Tenant: ${product.tenant_id}`);

        const { data: headers, error: headErr } = await supabase
            .from('bom_headers')
            .select('id, tenant_id, product_id, status')
            .eq('product_id', product.id);

        console.log("Headers:", headers?.length ? headers : "NONE");

        if (headers && headers.length > 0) {
            for (const header of headers) {
                const { data: items, error: itemErr } = await supabase
                    .from('bom_items')
                    .select('id, tenant_id, bom_header_id, component_product_id')
                    .eq('bom_header_id', header.id);

                console.log(`\tItems for Header ${header.id}:`, items?.length ? items : "NONE");
            }
        }
    }
}

checkCrossTenant();
