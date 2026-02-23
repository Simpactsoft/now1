const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("--- FINDING NOAM ---");
  const { data, error } = await supabase
    .from('cards')
    .select('id, display_name, first_name, last_name, email, type')
    .ilike('display_name', '%נועם%');
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

check();
