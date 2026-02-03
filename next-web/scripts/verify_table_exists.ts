
import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyTable() {
    console.log("--- starting rigorous check ---");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check entity_relationships
    console.log("Checking 'entity_relationships' (SELECT 1)...");
    const { data: d1, error: e1 } = await supabase
        .from('entity_relationships')
        .select('id')
        .limit(1);

    if (e1) {
        console.error("FAIL: entity_relationships", e1.message);
    } else {
        console.log("SUCCESS: entity_relationships found.");
    }

    // 2. Check relationship_types
    console.log("Checking 'relationship_types' (SELECT 1)...");
    const { data: d2, error: e2 } = await supabase
        .from('relationship_types')
        .select('id')
        .limit(1);

    if (e2) {
        console.error("FAIL: relationship_types", e2.message);
    } else {
        console.log("SUCCESS: relationship_types found.");
    }

    // 3. Check RPC
    console.log("Checking RPC 'get_entity_relationships'...");
    const { error: rpcError } = await supabase.rpc('get_entity_relationships', { p_entity_id: '00000000-0000-0000-0000-000000000000' });

    if (rpcError) {
        console.error("FAIL RPC:", rpcError.message);
    } else {
        console.log("SUCCESS: RPC executed (result might be empty but no error).");
    }
}

verifyTable();
