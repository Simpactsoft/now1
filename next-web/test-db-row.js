const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRow() {
    const { data, error } = await supabase.from('activities').select('*').limit(1);

    if (error) {
        console.error("Error:", error.message);
    } else {
        if (data.length > 0) {
            console.log("Columns from row data:", Object.keys(data[0]));
        } else {
            console.log("Table is empty, can't infer schema via select *.");
        }
    }
}

checkRow();
