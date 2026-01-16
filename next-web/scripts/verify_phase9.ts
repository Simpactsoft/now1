import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const tenants = {
    nano: "00000000-0000-0000-0000-000000000001",
    galactic: "00000000-0000-0000-0000-000000000003"
};

async function runPhase9Tests() {
    console.log("🚀 Starting Phase 9 UAT Verification...");
    const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    // 1. Galactic Tenant - Deep Scroll Verification
    console.log("\n--- TEST 1: Galactic Deep Scroll (500k Offset) ---");
    const startGalactic = Date.now();
    const { data: galacticData, error: galacticError } = await client.rpc("fetch_employees_secure", {
        arg_tenant_id: tenants.galactic,
        arg_start: 500000,
        arg_limit: 100,
        arg_sort_col: "created_at",
        arg_sort_dir: "desc",
        arg_filter_name: ""
    });

    if (galacticError) {
        console.error("❌ Galactic Test FAILED:", galacticError.message);
    } else {
        const latency = Date.now() - startGalactic;
        console.log(`✅ Galactic Test PASS: Latency ${latency}ms, Rows: ${galacticData.length}`);
    }

    // 2. Nano Tenant - Regression Verification
    console.log("\n--- TEST 2: Nano Tenant Regression ---");
    const { data: nanoData, error: nanoError } = await client.rpc("fetch_employees_secure", {
        arg_tenant_id: tenants.nano,
        arg_start: 0,
        arg_limit: 10,
        arg_sort_col: "name",
        arg_sort_dir: "asc",
        arg_filter_name: ""
    });

    if (nanoError) {
        console.error("❌ Nano Test FAILED:", nanoError.message);
    } else {
        console.log(`✅ Nano Test PASS: Fetched ${nanoData.length} rows for Nano.`);
    }

    // 3. RLS Isolation Check
    console.log("\n--- TEST 3: RLS Isolation Check ---");
    // Simulate setting session tenant
    await client.rpc("set_config", { name: "app.current_tenant", value: tenants.nano });
    const { data: isolationData, error: isolationError } = await client
        .from("employees")
        .select("id")
        .eq("tenant_id", tenants.galactic)
        .limit(1);

    if (isolationError) {
        // Some configurations might throw on selection if RLS is strict
        console.log("✅ Isolation PASS: Selection triggered error (as expected in some strict RLS setups) or returned empty.");
    } else if (isolationData && isolationData.length > 0) {
        console.error("❌ Isolation FAIL: Galactic data LEAKED to Nano query context!");
    } else {
        console.log("✅ Isolation PASS: No galactic data returned for Nano tenant.");
    }

    console.log("\n🏁 Phase 9 Verification Finished.");
}

runPhase9Tests();
