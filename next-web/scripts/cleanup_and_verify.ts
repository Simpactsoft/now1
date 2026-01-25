
import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const tenantId = "00000000-0000-0000-0000-000000000003";
    const personId = "e5568596-85dc-468f-8309-884355ac26d5";

    console.log("1. Cleaning up email...");
    // Restore original email or set to something clean
    const cleanEmail = "zhax@v.com"; // Based on earlier logs
    const contactMethods = [{ type: 'email', value: cleanEmail, is_primary: true }];

    // Update Parties Email and Status
    const { error: cleanupError } = await supabase
        .from('parties')
        .update({
            contact_methods: contactMethods,
            // Try updating custom_fields here to see if it works
            custom_fields: { status: "Customer", test_script: "true" }
        })
        .eq('id', personId);

    if (cleanupError) {
        console.error("Cleanup Failed:", cleanupError);
    } else {
        console.log("Cleanup Success. Email restored to:", cleanEmail);
        console.log("Attempted to set status to 'Customer' on PARTIES table.");
    }

    console.log("2. Verifying Parties Table Data...");
    const { data: partyData, error: fetchError } = await supabase
        .from('parties')
        .select('custom_fields, contact_methods')
        .eq('id', personId)
        .single();

    if (fetchError) {
        console.error("Fetch Error:", fetchError);
    } else {
        console.log("Party Data:", JSON.stringify(partyData, null, 2));
        if (partyData.custom_fields?.status === 'Customer') {
            console.log("SUCCESS: Status persisted to parties table.");
        } else {
            console.log("FAILURE: Status NOT found in parties table.");
        }
    }
}

run();
