require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log("Checking...", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const { data, error } = await supabase
    .from('cards')
    .select('id, type, status, display_name')
    .eq('type', 'organization')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("DB Error:", error);
  } else {
    console.log("Data:", JSON.stringify(data, null, 2));
  }
}

check();
