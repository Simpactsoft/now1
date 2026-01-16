import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPermissions() {
    console.log('🛡️ Checking permissions/RLS...');

    // Check if we can see any table names
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_table_counts_helper');
    if (rpcError) {
        console.log('RPC get_table_counts_helper failed (expected if not defined):', rpcError.message);
    }

    // Try to insert a dummy row into a temp table if we can, or just check errors on select
    const { error: empError } = await supabase.from('employees').select('id').limit(1);
    console.log('Employees access:', empError ? empError.message : 'OK');

    const { error: partError } = await supabase.from('parties').select('id').limit(1);
    console.log('Parties access:', partError ? partError.message : 'OK');

    // Check if RLS is enabled via a query that usually fails if RLS is on and we have no policy
    // Actually we can't do that easily as anon.
}

checkPermissions();
