
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFunction() {
    console.log("Checking create_person function...");
    const { data, error } = await supabase.rpc('create_person', {
        // Checking with minimal args to see if it even exists or if it errors on missing args
        arg_tenant_id: '00000000-0000-0000-0000-000000000000',
        arg_first_name: 'Check',
        arg_last_name: 'Me',
        arg_custom_fields: { status: 'Lead' }
    });

    if (error) {
        console.error("RPC Error:", error);
    } else {
        console.log("RPC Success:", data);
    }
}

async function inspectFunctionDefinition() {
    console.log("Inspecting function definition via SQL...");
    // Query pg_proc to see the arguments
    const { data, error } = await supabase
        .from('pg_proc')
        .select('proname, proargnames, prosrc') // using generic query if possible, but pg_proc is a system table, might not be accessible via API directly without rpc
        .eq('proname', 'create_person')
        .single(); // This usually fails due to permissions or not being exposed

    // Alternative: Use a direct SQL query via a known RPC or just infer from error
}

checkFunction();
