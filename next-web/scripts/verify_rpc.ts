
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Force load env from next-web/.env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Using Anon key to simulate real call

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Env Vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRpc() {
    console.log("Checking create_person RPC...");

    // Attempt with null arguments
    // We expect "invalid tenant id" or "insufficient privileges" or success, but NOT "function not found".
    // Wait, the RPC is SECURITY DEFINER, so Anon might not have EXECUTE permission if not granted.
    // However, error "function not found" is specific.

    const { data, error } = await supabase.rpc('create_person', {
        arg_tenant_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        arg_first_name: 'Test',
        arg_last_name: 'Probe',
        arg_email: null,
        arg_phone: null
    });

    if (error) {
        console.error("RPC Failed:", error);
        if (error.message.includes("Could not find the function")) {
            console.log("\n>>> DIAGNOSIS: The migration was NOT applied or the schema cache is stale.");
            console.log(">>> ACTION: Go to Supabase Dashboard > SQL Editor and run the migration manually.");
        }
    } else {
        console.log("RPC Success! Response:", data);
        console.log("\n>>> DIAGNOSIS: The function exists and works.");
    }
}

checkRpc();
