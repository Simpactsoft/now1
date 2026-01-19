require('dotenv').config({ path: ['.env.local', '.env'] });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listTenants() {
    console.log("Fetching tenants...");
    const { data, error } = await supabase
        .from('tenants')
        .select('id, name');

    if (error) {
        console.error("Error fetching tenants:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No tenants found.");
        return;
    }

    console.log("\n--- Tenant List ---");
    data.forEach(t => {
        console.log(`[${t.name}] -> ${t.id}`);
    });
}

listTenants();
