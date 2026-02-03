
import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = "https://fmhnwxtapdqzqrsjdxsm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaG53eHRhcGRxenFyc2pkeHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM3MjEzNiwiZXhwIjoyMDgzOTQ4MTM2fQ.YmrQVitsfdrD3ZwGAyaKZcuK_edIx20g8v8NPs5u8MI";

async function reloadSchema() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Attempting to reload PostgREST schema cache...");

    // We can't easily run raw SQL via JS client without an RPC, 
    // unless we have a 'exec_sql' function exposed (which is common in some setups but not default).
    // However, creating a dummy resource usually triggers it.

    // Attempt 1: Just verify connection
    const { data, error } = await supabase.from('relationship_types').select('count', { count: 'exact', head: true });

    if (error) {
        console.log("Still failing:", error.message);

        // Attempt 2: Run a harmless RPC if available, or try to create a dummy row in a known table to wake it up? 
        // No, that doesn't trigger DDL reload.
        // We really need to run NOTIFY pgrst, 'reload config'

        console.log("The user usually needs to run the migration or reload manually if we can't execute raw SQL.");
        console.log("I will advise the user to restart or I will create a migration file for them to apply if they use a migration tool.");
    } else {
        console.log("Warning: It worked this time! Maybe it just needed a moment?");
    }
}

reloadSchema();
