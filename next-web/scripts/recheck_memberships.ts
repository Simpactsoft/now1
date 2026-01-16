import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function reCheck() {
    const { count, error } = await supabase.from('party_memberships').select('*', { count: 'exact', head: true });
    console.log('Final Membership Count:', error ? error.message : count);
}

reCheck();
