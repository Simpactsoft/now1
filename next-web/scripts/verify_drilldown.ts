
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Test with Service Role to guarantee we *can* verify schema existence
// But also test with ANON to simulate user.
// Wait, the RPC is Security Definer, so ANON *should* work if granted.

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('--- Verifying Admin Drill-Down RPCs ---');

    // 1. Fetch All Tenants (Grid)
    console.log('\n1. Testing get_admin_tenants()...');
    const { data: allTenants, error: allError } = await supabase.rpc('get_admin_tenants');

    if (allError) {
        console.error('FAILED to call get_admin_tenants:', allError);
    } else {
        console.log(`SUCCESS: Found ${allTenants?.length || 0} tenants.`);
        if (allTenants && allTenants.length > 0) {
            const firstId = allTenants[0].id;
            console.log(`   Sample ID: ${firstId} (${allTenants[0].name})`);

            // 2. Fetch Single Tenant (Drill Down)
            console.log(`\n2. Testing get_admin_tenant('${firstId}')...`);
            const { data: single, error: singleError } = await supabase
                .rpc('get_admin_tenant', { arg_tenant_id: firstId })
                .single(); // Mimic strict single

            if (singleError) {
                console.error('FAILED to call get_admin_tenant:', singleError);
                // Verify if it works WITHOUT .single()
                const { data: raw } = await supabase.rpc('get_admin_tenant', { arg_tenant_id: firstId });
                console.log('   Raw result (without .single):', raw);
            } else {
                console.log('SUCCESS: Fetched single tenant:', single.name);
            }
        } else {
            console.warn('No tenants found to test single fetch.');
        }
    }
}

verify();
