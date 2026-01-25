
import { updatePerson } from "../src/app/actions/updatePerson";
import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

// Mock Supabase Server Client for reproduction script (since we can't use next/headers cookies)
// We need to bypass the auth check in updatePerson or mock it.
// Actually, updatePerson uses `createClient` from `@lib/supabase/server` which uses `cookies()`.
// This won't work in a script.
// We need to check if we can call the DB update directly or mock the action context.

// Alternative: Use the script to call the DB directly similar to how updatePerson does it, 
// to see if the DB operation works. 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const tenantId = "00000000-0000-0000-0000-000000000003"; // From logs
    const personId = "e5568596-85dc-468f-8309-884355ac26d5"; // From logs

    console.log("1. Fetching current person...");
    const { data: before } = await supabase.rpc("fetch_person_profile", {
        arg_tenant_id: tenantId,
        arg_person_id: personId
    });
    console.log("Before Email:", before?.[0]?.email);
    console.log("Before Contact Methods:", JSON.stringify(before?.[0], null, 2)); // Contact methods not returned by RPC directly, but we can inspect via table

    console.log("2. Updating email via direct DB Update (simulating updatePerson logic)...");

    // Simulate logic from updatePerson.ts
    const newEmail = "test_update_" + Date.now() + "@example.com";
    const contactMethods = [{ type: 'email', value: newEmail, is_primary: true }];

    const { error: updateError } = await supabase
        .from('parties')
        .update({
            contact_methods: contactMethods,
            updated_at: new Date().toISOString()
        })
        .eq('id', personId)
        .eq('tenant_id', tenantId);

    if (updateError) {
        console.error("Update Failed:", updateError);
    } else {
        console.log("Update Success.");
    }

    console.log("3. Fetching again...");
    const { data: after } = await supabase.rpc("fetch_person_profile", {
        arg_tenant_id: tenantId,
        arg_person_id: personId
    });
    console.log("After Email:", after?.[0]?.email);

    // Also check raw table
    const { data: raw } = await supabase.from('parties').select('contact_methods').eq('id', personId).single();
    console.log("Raw Table Data:", JSON.stringify(raw, null, 2));
}

run();
