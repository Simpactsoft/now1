import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'; // wait, node might not have it

async function run() {
    const { data, error } = await createClient(supabaseUrl, supabaseKey).rpc('fetch_people_data', {});
    console.log(data, error);
}

run();
