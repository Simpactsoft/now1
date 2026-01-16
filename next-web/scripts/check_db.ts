import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../api/.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkTenants() {
    console.log("Checking Supabase URL:", SUPABASE_URL);

    const anonClient = createClient(SUPABASE_URL!, ANON_KEY!);
    const { data: anonData, error: anonError } = await anonClient.from("tenants").select("*");

    console.log("\n--- ANON CLIENT CHECK ---");
    if (anonError) console.error("Error fetching as anon:", anonError);
    else console.log(`Found ${anonData?.length || 0} tenants as anon.`);

    if (SERVICE_KEY) {
        const adminClient = createClient(SUPABASE_URL!, SERVICE_KEY);
        const { data: adminData, error: adminError } = await adminClient.from("tenants").select("*");
        console.log("\n--- ADMIN CLIENT CHECK ---");
        if (adminError) console.error("Error fetching as admin:", adminError);
        else console.log(`Found ${adminData?.length || 0} tenants as admin.`);

        if (adminData && adminData.length > 0) {
            console.log("Sample Tenant Names:", adminData.map(t => t.name).join(", "));
        }
    } else {
        console.log("\n--- ADMIN CHECK SKIPPED (No Service Key) ---");
    }
}

checkTenants();
