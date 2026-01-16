import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../api/.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // I need this!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

async function runTests() {
    console.log("🚀 Starting System Verification...");

    // --- TEST A: Security (Isolation) ---
    console.log("\n--- TEST A: Data Isolation ---");
    const nanoUser = createClient(SUPABASE_URL!, ANON_KEY!);

    // Try to set tenant to Nano
    await nanoUser.rpc("set_session_tenant", {
        tid: "00000000-0000-0000-0000-000000000001"
    });


    const { data: nanoData, count: nanoCount } = await nanoUser
        .from("employees")
        .select("*", { count: "exact", head: true });

    console.log(`Nano Tenant Count: ${nanoCount}`);

    // Now try to fetch Galactic data while impersonating Nano
    const { data: galacticAttempt } = await nanoUser
        .from("employees")
        .select("*")
        .eq("tenant_id", "00000000-0000-0000-0000-000000000003")
        .limit(10);

    if (!galacticAttempt || galacticAttempt.length === 0) {
        console.log("✅ Isolation PASS: Cannot see Galactic data from Nano context.");
    } else {
        console.log("❌ Isolation FAIL: Galactic data LEAKED to Nano context!");
    }

    // --- TEST B: Performance ---
    console.log("\n--- TEST B: Performance (1M Rows Latency) ---");
    const galacticContext = createClient(SUPABASE_URL!, ANON_KEY!);

    const start = Date.now();
    const { data: perfData, error: perfError } = await galacticContext
        .rpc("fetch_employees_secure", {
            p_tenant_id: "00000000-0000-0000-0000-000000000003",
            p_start: 500000,
            p_limit: 100,
            p_sort_col: "created_at",
            p_sort_dir: "desc",
            p_filter_name: ""
        });

    const latency = Date.now() - start;

    if (perfError) {
        console.error("Performance Test Error:", perfError);
    } else {
        console.log(`Latency for 100 rows in 1M dataset: ${latency}ms`);
        if (latency < 200) {
            console.log("✅ Performance PASS: Latency < 200ms");
        } else {
            console.log("⚠️ Performance WARNING: Latency > 200ms");
        }

        // --- TEST D: Analytics ---
        console.log("\n--- TEST D: Analytics (Hierarchical Aggregation) ---");
        const analyticsStart = Date.now();
        const { data: analyticsData, error: analyticsError } = await galacticContext
            .rpc("get_org_analytics", {
                p_tenant_id: "00000000-0000-0000-0000-000000000003",
                p_base_path: ""
            });

        if (analyticsError) {
            console.error("Analytics Test Error:", analyticsError);
        } else {
            const latency = Date.now() - analyticsStart;
            console.log(`Analytics Latency: ${latency}ms`);
            console.log(`Top Level Departments: ${analyticsData?.length || 0}`);
            if (latency < 500) {
                console.log("✅ Analytics PASS: Latency < 500ms");
            } else {
                console.log("⚠️ Analytics WARNING: Latency > 500ms");
            }
        }
    }

    // --- TEST C: Impersonation (Requires Service Role) ---
    if (SUPABASE_SERVICE_ROLE_KEY) {
        console.log("\n--- TEST C: RBAC Impersonation ---");
        const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY);

        // Grant admin claim to a dummy user
        const dummyUserId = "00000000-0000-0000-0000-000000000000"; // hypothetical
        const { error: claimError } = await admin.rpc("set_claim", {
            uid: dummyUserId,
            claim: "role",
            value: "admin"
        });

        if (claimError) {
            console.error("Claim Error:", claimError);
        } else {
            console.log("✅ Impersonation PASS: Admin claim set via service_role.");
        }
    } else {
        console.log("\n--- TEST C: SKIPPED (No Service Role Key) ---");
    }

    console.log("\n✅ Verification Finished.");
}

runTests();
