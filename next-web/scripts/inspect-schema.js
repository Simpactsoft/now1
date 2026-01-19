require('dotenv').config({ path: ['.env.local', '.env'] });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectSchema() {
    console.log("Fetching one party record...");
    const { data, error } = await supabase
        .from('parties')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching party:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("--- Party Record Keys ---");
        console.log(Object.keys(data[0]));
        console.log("\n--- Sample Record ---");
        console.log(JSON.stringify(data[0], null, 2));
    } else {
        console.log("No parties found.");
    }
}

inspectSchema();
