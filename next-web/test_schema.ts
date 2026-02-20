import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We can execute an anonymous SQL query if the project has the exec_sql RPC 
// let's try calling it.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    const { data, error } = await supabase.rpc('test_exec_sql', {
        query: `
            SELECT kc.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kc 
              ON tc.constraint_name = kc.constraint_name
            WHERE tc.table_name = 'cards' AND tc.constraint_type = 'PRIMARY KEY';
        `
    });
    console.log("EXEC RESULT:", data, error);
}

run().catch(console.error);
