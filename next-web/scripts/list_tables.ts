import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../api/.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function listTables() {
    const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!);
    const { data, error } = await supabase.rpc('get_tables'); // Most Supabase DBs don't have this RPC by default, we'll try raw query if it fails

    // Alternative: fetch from information_schema via a function if we can, 
    // but we can just use the admin client's ability to run a common query if we had one.
    // Instead, let's just try to select from common tables and see which exist.

    const possibleTables = ["tenants", "employees", "tenant_members", "users", "profiles"];
    console.log("Checking table existence...");
    for (const table of possibleTables) {
        const { error } = await supabase.from(table).select("*", { count: 'exact', head: true });
        if (!error) {
            console.log(`✅ Table '${table}' exists.`);
        } else {
            console.log(`❌ Table '${table}' check failed: ${error.message}`);
        }
    }
}

listTables();
