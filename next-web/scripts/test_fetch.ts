import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../api/.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testFetchEmployees() {
    const supabase = createClient(SUPABASE_URL!, ANON_KEY!);

    // Get a valid tenant ID first
    const { data: tenants } = await supabase.rpc("get_my_tenants");
    if (!tenants || tenants.length === 0) {
        console.log("No tenants found to test with.");
        return;
    }

    const tenantId = tenants[0].id;
    console.log(`Testing fetch_employees_secure for tenant: ${tenants[0].name} (${tenantId})`);

    const { data, error } = await supabase.rpc("fetch_employees_secure", {
        p_tenant_id: tenantId,
        p_start: 0,
        p_limit: 10,
        p_sort_col: "name",
        p_sort_dir: "asc",
        p_filter_name: ""
    });

    if (error) {
        console.error("❌ RPC Error:", JSON.stringify(error, null, 2));
    } else {
        console.log(`✅ RPC Success: Found ${data?.length || 0} employees`);
        if (data && data.length > 0) {
            console.log("Sample Data:", JSON.stringify(data[0], null, 2));
        }
    }
}

testFetchEmployees();
