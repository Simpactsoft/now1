
import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const tenantId = "00000000-0000-0000-0000-000000000003";
    // Need a valid person ID. From previous logs: e5568596-85dc-468f-8309-884355ac26d5
    const personId = "e5568596-85dc-468f-8309-884355ac26d5";

    console.log("Fetching person profile via RPC...");
    const { data, error } = await supabase.rpc("fetch_person_profile", {
        arg_tenant_id: tenantId,
        arg_person_id: personId
    });

    if (error) {
        console.error("RPC Error:", error);
    } else {
        const profile = data?.[0];
        console.log("RPC Return Keys:", profile ? Object.keys(profile) : "No data");
        if (profile) {
            console.log("profile.tags:", JSON.stringify(profile.tags, null, 2));
            console.log("profile.custom_fields:", JSON.stringify(profile.custom_fields, null, 2));
        }
    }
}

run();
