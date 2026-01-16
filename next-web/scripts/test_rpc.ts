import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
    const tenantId = '00000000-0000-0000-0000-000000000001'; // Default tenant from seeds
    console.log(`Testing RPC for Tenant: ${tenantId}`);

    const { data, error } = await supabase.rpc('fetch_employees_secure', {
        arg_tenant_id: tenantId,
        arg_start: 0,
        arg_limit: 10,
        arg_sort_col: 'name',
        arg_sort_dir: 'asc',
        arg_filter_name: ''
    });

    if (error) {
        console.error('RPC Error:', JSON.stringify(error, null, 2));
    } else {
        console.log('RPC Success! First row:', data?.[0]);
    }
}

testRpc();
