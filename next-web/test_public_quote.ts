import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminClient = createClient(supabaseUrl, supabaseKey);

async function testFetch() {
    const { data: quote, error } = await adminClient
        .from("quotes")
        .select(`
            *,
            customer:cards ( id, display_name, contact_methods ),
            items:quote_items (
                id, product_id, configuration_id, quantity, unit_price, line_total,
                product:products ( name, description, sku )
            ),
            tenant:tenants ( name )
        `)
        .limit(1);

    if (error) {
        console.error("EXACT ERROR MESSAGE:", JSON.stringify(error, null, 2));
    } else {
        console.log("SUCCESS");
    }
}
testFetch();
