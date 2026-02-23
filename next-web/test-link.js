const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkDb() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: parts, error: partsError } = await supabase.from('activity_participants').select('*').limit(1);
    console.log("Parts v1 Error:", partsError?.message || 'Success');
}

checkDb();
