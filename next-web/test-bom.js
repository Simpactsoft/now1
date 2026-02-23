const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkBom() {
    console.log("Checking products...");
    const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id, name')
        .ilike('name', '%Light Aircraft%');

    if (prodErr || !products?.length) {
        console.log("Product not found:", prodErr);
        return;
    }

    const product = products[0];
    console.log("Found product:", product.name, "ID:", product.id);

    console.log("\nChecking BOM headers...");
    const { data: headers, error: headErr } = await supabase
        .from('bom_headers')
        .select('*')
        .eq('product_id', product.id);

    console.log("Headers:", JSON.stringify(headers, null, 2));

    if (headers && headers.length > 0) {
        console.log("\nChecking BOM items for header", headers[0].id);
        const { data: comps, error: compErr } = await supabase
            .from('bom_items')
            .select(`
            *,
            component:component_product_id(id, name, sku)
        `)
            .eq('bom_header_id', headers[0].id);

        console.log("Items Error:", compErr);
        console.log("Items count:", comps ? comps.length : 0);
        // console.log("Items:", JSON.stringify(comps, null, 2));

        console.log("\nTesting RPC 'get_bom_tree'...");
        const { data: tree, error: treeErr } = await supabase
            .rpc('get_bom_tree', {
                p_product_id: product.id,
                p_version: headers[0].version
            });

        console.log("RPC Tree Error:", treeErr);
        console.log("RPC Tree count:", tree ? tree.length : 0);
        // console.log("RPC Tree Result:", JSON.stringify(tree, null, 2));
    }
}

checkBom();
