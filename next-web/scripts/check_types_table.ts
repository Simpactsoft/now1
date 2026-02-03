
import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = "https://fmhnwxtapdqzqrsjdxsm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaG53eHRhcGRxenFyc2pkeHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM3MjEzNiwiZXhwIjoyMDgzOTQ4MTM2fQ.YmrQVitsfdrD3ZwGAyaKZcuK_edIx20g8v8NPs5u8MI";

async function checkTable() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check relationship_types
    const { data, error } = await supabase
        .from('relationship_types')
        .select('*', { count: 'exact', head: true });

    if (error) {
        if (error.code === '42P01') {
            console.log("Table 'relationship_types' does NOT exist.");
        } else {
            console.log("Error checking relationship_types:", error.message);
        }
    } else {
        console.log("Table 'relationship_types' EXISTS.");
    }
}

checkTable();
