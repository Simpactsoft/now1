
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load Env
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Env Vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Introspecting 'parties' table...");

    // Select * limit 1 to see keys
    const { data, error } = await supabase
        .from('parties')
        .select('*')
        .limit(1);

    if (error) {
        console.error("SELECT * failed:", error.message);
    } else {
        if (data && data.length > 0) {
            console.log("Column Names:", Object.keys(data[0]).join(", "));
        } else {
            console.log("Table is empty, cannot inspect keys via data.");
        }
    }
}

run();
