import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const email = 'impact.art+yosi@gmail.com';
    console.log("TESTING FALLBACK FOR:", email);

    // 1. Try legacy cards table
    const { data: cards } = await supabase.from('cards').select('*').eq('email', email).limit(1);
    if (cards && cards.length > 0) {
        console.log("FOUND IN CARDS:", cards[0].id);
        return;
    }
    console.log("Not in cards.");

    // 2. Try modern parties table
    const { data: parties, error } = await supabase
        .from('parties')
        .select(`
          id, display_name, avatar_url, contact_methods, custom_fields, type,
          people (first_name, last_name, gender)
      `)
        .contains('contact_methods', [{ value: email }])
        .limit(1);

    if (error) {
        console.log("ERROR QUERYING PARTIES:", error);
    }

    if (parties && parties.length > 0) {
        console.log("FOUND IN PARTIES:", parties[0].id);
        return;
    }

    console.log("Not in parties.");
}
run();
