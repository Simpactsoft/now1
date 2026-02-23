const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function reloadSchemaCache() {
    console.log('Reloading Supabase schema cache...');

    // To reload the schema cache in Supabase via API, we can either call an RPC
    // or just query a non-existent table to force an error, which sometimes triggers a reload.
    // The correct SQL command is `NOTIFY pgrst, reload_schema;` but standard client can't run arbitrary SQL.
    // Let's try to query the table using the new column. If it still fails, I'll tell the user to restart Supabase.
    const { data, error } = await supabase.from('activities').select('due_date').limit(1);

    if (error) {
        console.error("Still error:", error.message);
    } else {
        console.log("Success! Columns:", data);
    }
}

reloadSchemaCache();
