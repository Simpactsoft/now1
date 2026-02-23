import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: sets, error: getSetsError } = await supabase.from('option_sets').select('*').eq('code', 'ORGANIZATION_STATUS');
    console.log("Sets Error:", getSetsError);
    console.log("Sets:", sets);
    if (sets && sets.length > 0) {
        const { data: vals } = await supabase.from('option_values').select('*').eq('option_set_id', sets[0].id);
        console.log("Values:", vals);
    }
}
run();
