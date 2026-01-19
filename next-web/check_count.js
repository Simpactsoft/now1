
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Using Key Type:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "Service Role (Bypass RLS)" : "Anon (RLS Restricted)");

async function checkCount() {
    if (!supabaseUrl || !supabaseKey) {
        console.error("Supabase credentials not found");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get Tenant ID for 'Orbit Enterprise'
    const { data: tenants, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name')
        .ilike('name', 'Orbit Enterprise%');

    if (tenantError) {
        console.error("Error fetching tenants:", tenantError);
        return;
    }

    console.log("Tenants found:", tenants);

    if (tenants && tenants.length > 0) {
        const tenantId = tenants[0].id;

        // 2. Count parties
        const { count, error: countError } = await supabase
            .from('parties')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('type', 'person');

        if (countError) {
            console.log("Error fetching count with Anon Key (likely RLS):", countError.message);
        } else {
            console.log(`Count for tenant ${tenantId} name ${tenants[0].name}: ${count}`);
        }
    } else {
        console.log("Orbit Enterprise tenant not found.");
    }
}

checkCount();
