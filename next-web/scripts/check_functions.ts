import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../api/.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function checkFunctions() {
    const supabase = createClient(SUPABASE_URL!, ANON_KEY!);

    const functions = [
        "fetch_employees_secure",
        "get_org_analytics",
        "get_tenant_summary",
        "set_session_tenant"
    ];

    console.log("Checking RPC Functions...");
    for (const fn of functions) {
        // We try calling them with dummy data just to see if they exist (PGRST202 means missing)
        const { error } = await supabase.rpc(fn, {
            p_tenant_id: "00000000-0000-0000-0000-000000000000",
            // adding some dummy params to avoid signature mismatch if it DOES exist
            p_start: 0, p_limit: 1, p_sort_col: "id", p_sort_dir: "asc", p_filter_name: ""
        });

        if (error && error.code === "PGRST202") {
            console.log(`❌ ${fn}: MISSING`);
        } else if (error) {
            console.log(`✅ ${fn}: EXISTS (Returned error ${error.code}: ${error.message})`);
        } else {
            console.log(`✅ ${fn}: EXISTS (Success)`);
        }
    }
}

checkFunctions();
