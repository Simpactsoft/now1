require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  console.log("Fixing Orgs...");
  const { data, error } = await supabase
    .from('cards')
    .update({ status: 'PROSPECT' })
    .eq('type', 'organization')
    .in('status', ['lead', 'LEAD'])
    .select('id, display_name, status');
    
  if (error) {
     console.error("DB Error:", error);
  } else {
     console.log(`Updated ${data.length} organizations.`);
     console.log(data);
  }
}

fix();
