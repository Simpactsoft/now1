const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const tenantId = '4d145b9e-4a75-5567-a0af-bcc4a30891e5'; // Nano Inc
    const sourceId = '195bf7c4-be56-4fe4-9dc6-c58cfc351e5e'; // Widget A
    console.log("Running query...");
    const { data, error } = await supabase
        .from("product_relationships")
        .select(`
                relationship_type,
                confidence_score,
                source_product_id,
                target:products!product_relationships_target_product_id_fkey (
                    id,
                    name,
                    sku,
                    list_price,
                    is_active
                )
            `)
        .eq("tenant_id", tenantId)
        .in("source_product_id", [sourceId])
        .order("confidence_score", { ascending: false });

    console.log("Joined Data:", JSON.stringify(data, null, 2));
    console.log("Error:", error);
}
run();
