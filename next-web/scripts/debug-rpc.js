
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
    console.log('--- RPC Diagnostic Test ---');

    // 1. Get a Tenant
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
    if (!tenants || tenants.length === 0) {
        console.error('No tenants found');
        return;
    }
    const tenantId = tenants[0].id; // Use the first tenant (likely Galactic Stress Test if id 000...03)
    console.log('Testing Tenant:', tenantId);

    // 2. Fetch with Single Status (String) - Baseline
    console.log('\n1. Testing Single String Filter (Status: "Lead")');
    const { data: singleData, error: singleError } = await supabase.rpc('fetch_people_crm', {
        arg_tenant_id: tenantId,
        arg_filters: { status: 'Lead' }
    });

    if (singleError) {
        console.error('Single Filter Error:', singleError);
    } else {
        const count = singleData.length > 0 ? singleData[0].ret_total_count : 0;
        console.log('Single Filter Count:', count);
    }

    // 3. Fetch with Array Status (Multi-Select)
    console.log('\n2. Testing Array Filter (Status: ["Lead", "Customer"])');
    // Note: We need to pass the array as part of the JSONB object
    const { data: arrayData, error: arrayError } = await supabase.rpc('fetch_people_crm', {
        arg_tenant_id: tenantId,
        arg_filters: { status: ['Lead', 'Customer'] }
    });

    if (arrayError) {
        console.error('Array Filter Error:', arrayError);
        console.log('--> DIAGNOSIS: RPC might have crashed or signature mismatch.');
    } else {
        const count = arrayData && arrayData.length > 0 ? arrayData[0].ret_total_count : 0;
        console.log('Array Filter Count:', count);

        if (count === 0 && (singleData && singleData.length > 0)) {
            console.log('--> DIAGNOSIS: Migration MISSING. Array filter returned 0 matches while Single returned data.');
        } else {
            console.log('--> DIAGNOSIS: Migration LIKELY APPLIED (or data is empty for both).');
        }
    }
}

testRpc();
