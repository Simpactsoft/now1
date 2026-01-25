
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

async function checkColumns() {
    console.log("Checking people table columns...");
    // Since we cannot select * from information_schema easily with just client unless we have permissions or RPC
    // We can try to select a known record and see if it returns custom_fields or error?
    // Or we can just select 'custom_fields' from parties limit 1

    const { data, error } = await supabase
        .from('people')
        .select('custom_fields')
        .limit(1);

    if (error) {
        console.error("Error accessing people custom_fields:", error);
    } else {
        console.log("Success accessing people custom_fields. Data:", data);
        if (data) {
            console.log("Column custom_fields EXISTS in people.");
        }
    }
}

checkColumns();
