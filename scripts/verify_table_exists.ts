
import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyTable() {
    console.log("Verifying table 'entity_relationships'...");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from('entity_relationships')
        .select('count', { count: 'exact', head: true });

    if (error) {
        console.error("Error accessing table:", error);
        if (error.message.includes('does not exist')) {
            console.error("FATAL: Table truly does not exist.");
        }
    } else {
        console.log("SUCCESS: Table exists and is accessible.");
        console.log("Count:", data); // data is null for head: true usually, but count is returned in count property if we asked for it, wait, head: true returns null data.
    }

    // Also check RPC
    console.log("Verifying RPC 'get_entity_relationships'...");
    const { error: rpcError } = await supabase.rpc('get_entity_relationships', { p_entity_id: '00000000-0000-0000-0000-000000000000' });
    if (rpcError) {
        console.error("RPC Error:", rpcError);
    } else {
        console.log("SUCCESS: RPC exists.");
    }
}

verifyTable();
