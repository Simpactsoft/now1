
const { createClient } = require('@supabase/supabase-js');

// Load env vars
// Note: In a real environment we would likely use dotenv, but here we might not have it configured for scripts easily.
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role Key for Admin Access

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
    console.log("--- Starting RPC Debug (Admin Mode) ---");

    // 1. Fetch Grouped Data to see what keys are returned
    console.log("\n1. Testing fetch_grouped_data (get_people_grouped)...");

    const { data: parties, error: pError } = await supabase.from('parties').select('tenant_id').limit(1);
    if (pError || !parties || parties.length === 0) {
        console.error("Could not fetch a tenant_id:", pError);
        return;
    }
    const tenantId = parties[0].tenant_id;
    console.log("Using Tenant ID:", tenantId);

    // Corrected RPC Name and Args based on fetchPeopleGrouped.ts
    const { data: groups, error: gError } = await supabase.rpc('get_people_grouped', {
        arg_tenant_id: tenantId,
        arg_group_field: 'status'
    });

    if (gError) {
        console.error("Group RPC Error:", gError);
    } else {
        console.log("Group Keys found:", groups);
    }

    if (!groups || groups.length === 0) {
        console.log("No groups found. Cannot test filter.");
        return;
    }

    // Groups usually return { group_key: '...', count: ... }
    const testStatus = groups[0].group_key; // e.g., 'Customer'
    if (!testStatus) {
        console.log("First group has no key (null).");
        return;
    }

    console.log(`\n2. Testing fetch_people_crm with status='${testStatus}' (Exact match from Group keys)`);

    const { data: d1, error: e1 } = await supabase.rpc('fetch_people_crm', {
        arg_tenant_id: tenantId,
        arg_start: 0,
        arg_limit: 10,
        arg_sort_col: 'created_at',
        arg_sort_dir: 'desc',
        arg_filters: { status: testStatus }
    });

    if (e1) console.error("Filter Exact Error:", e1);
    // fetch_people_crm returns rowData.
    console.log(`Results for exact match '${testStatus}':`, d1 ? d1.length : 0);

    // 3. Test generic lower case
    const lowerStatus = testStatus.toLowerCase();

    console.log(`\n3. Testing fetch_people_crm with status='${lowerStatus}' (Lowercase)`);
    const { data: d2, error: e2 } = await supabase.rpc('fetch_people_crm', {
        arg_tenant_id: tenantId,
        arg_start: 0,
        arg_limit: 10,
        arg_sort_col: 'created_at',
        arg_sort_dir: 'desc',
        arg_filters: { status: lowerStatus }
    });
    if (e2) console.error("Filter Lower Error:", e2);
    console.log(`Results for lower match '${lowerStatus}':`, d2 ? d2.length : 0);


    // 4. Test User provided example "Customer" (Title Case)
    const titleStatus = "Customer";
    console.log(`\n4. Testing fetch_people_crm with status='${titleStatus}' (Hardcoded Title Case)`);
    const { data: d3, error: e3 } = await supabase.rpc('fetch_people_crm', {
        arg_tenant_id: tenantId,
        arg_start: 0,
        arg_limit: 10,
        arg_sort_col: 'created_at',
        arg_sort_dir: 'desc',
        arg_filters: { status: titleStatus }
    });
    if (e3) console.error("Filter Title Error:", e3);
    console.log(`Results for title match '${titleStatus}':`, d3 ? d3.length : 0);

}

testRpc();
