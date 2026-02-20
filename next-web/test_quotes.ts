import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminClient = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: quotes, error: quotesError } = await adminClient
        .from("quotes")
        .select("id, public_token, customer_id")
        .limit(1);

    if (quotesError) {
        console.error("QUOTES ERROR:", quotesError);
    } else {
        console.log("QUOTES FOUND:", quotes);
    }
}
test();
