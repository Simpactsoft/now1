import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkParties() {
    console.log('🔍 Checking parties content...');

    const { data, error } = await supabase.from('parties').select('*').limit(5);

    if (error) {
        console.error('Error fetching parties:', error.message);
    } else {
        console.log('Sample parties:', JSON.stringify(data, null, 2));
    }
}

checkParties();
