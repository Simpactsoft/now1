import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Starting test...");
  const { data: quotes, error: quotesError } = await supabase.from('quotes').select('id, public_token').limit(1);

  if (!quotes || quotes.length === 0) {
    console.log("No quotes found.");
    return;
  }
  const token = quotes[0].public_token;

  console.log("Testing full join with token:", token);
  const { data, error } = await supabase
    .from("quotes")
    .select(`
        *,
        customer:cards (*),
        items:quote_items (
            id, product_id, configuration_id, quantity, unit_price, line_total,
            product:products ( name, description, sku, images )
        ),
        tenant:tenants ( name, logo_url, custom_domain )
    `)
    .eq("public_token", token)
    .single();

  console.log("Fetch result data:", data);
  console.log("Fetch error:", error);
}

test().catch(console.error);
