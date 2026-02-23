import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const email = 'impact.art+yosi@gmail.com';
    console.log("Checking parties for:", email);

    // Find party by email in contact_methods jsonb array
    // contact_methods @> '[{"value": "impact.art+yosi@gmail.com"}]'
    const { data: parties, error } = await supabase
        .from('parties')
        .select(`
      id,
      display_name,
      avatar_url,
      contact_methods,
      custom_fields,
      type,
      people (
        first_name,
        last_name,
        gender
      )
    `)
        .contains('contact_methods', [{ value: email }]);

    console.log("PARTIES:", JSON.stringify(parties, null, 2), error);
}

run();
