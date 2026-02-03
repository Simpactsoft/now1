
import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = "https://fmhnwxtapdqzqrsjdxsm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaG53eHRhcGRxenFyc2pkeHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM3MjEzNiwiZXhwIjoyMDgzOTQ4MTM2fQ.YmrQVitsfdrD3ZwGAyaKZcuK_edIx20g8v8NPs5u8MI";

async function checkTable() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from('entity_relationships')
        .select('count', { count: 'exact', head: true });

    if (error) {
        if (error.code === '42P01') { // undefined_table
            console.log("Table 'entity_relationships' does NOT exist.");
        } else {
            console.log("Error checking table:", error.message);
        }
    } else {
        console.log("Table 'entity_relationships' EXISTS.");
    }
}

checkTable();
