import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Manually parse .env.local to ensure we get the keys regardless of process.cwd()
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Try Service Key first, fallback to Anon Key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or Valid Key');
    console.error('Available keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function testSearch() {
    // 1. First, find a valid tenant
    // We use the known seed Tenant ID to likely find data
    const tenantId = "00000000-0000-0000-0000-000000000003";

    console.log(`🔎 Testing Search on Tenant: ${tenantId}`);

    // 2. Search for ANYTHING to verify basic connectivity/RLS
    console.log(`\n--- Searching for (Empty String) ---`);
    const { data: res0, error: err0 } = await supabase.rpc('fetch_people_crm', {
        arg_tenant_id: tenantId,
        arg_filter_name: '',
        arg_limit: 5
    });

    if (err0) {
        console.error("❌ RPC Error (Empty Search):", err0);
        return;
    }

    console.log(`Found ${res0?.length || 0} results for empty search.`);
    if (res0 && res0.length > 0) {
        console.log("Sample Data:", res0[0]);
    } else {
        console.log("⚠️ No data found in empty search. Cannot proceed with reversal test.");
        return;
    }

    // 3. Test Multi-word Search using REAL data
    const realPerson = res0[0];
    if (realPerson && realPerson.ret_name) {
        const originalName = realPerson.ret_name;
        // Handle Hebrew ' ' separator if different? No, standard space.
        const parts = originalName.split(' ');

        if (parts.length > 1) {
            // Reverse the name
            const reversed = [parts[1], parts[0]].join(' ');
            console.log(`\n--- Searching for REVERSED: "${reversed}" (Original: "${originalName}") ---`);

            const { data: res2, error: err2 } = await supabase.rpc('fetch_people_crm', {
                arg_tenant_id: tenantId,
                arg_filter_name: reversed,
                arg_limit: 5
            });

            if (err2) {
                console.error("❌ RPC Error:", err2);
            } else {
                // Check if our original person is in the results
                const found = res2.some((p: any) => p.ret_id === realPerson.ret_id);
                if (found) {
                    console.log(`✅ SUCCESS: Found "${originalName}" when searching for "${reversed}"`);
                } else {
                    console.log(`❌ FAILURE: Did NOT find the exact record.`);
                    console.log(`Found ${res2.length} other results.`);
                    if (res2.length > 0) console.log("First result:", res2[0].ret_name);
                }
            }
        } else {
            console.log(`Skipping reversal test: Name "${originalName}" is single word.`);
        }
    } else {
        console.log("Could not find a valid person to test.");
    }
}

testSearch();
