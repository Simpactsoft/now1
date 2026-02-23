const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("Testing API Access to 'parties' after cache reload...");
  
  const email = 'impact.art+yosi@gmail.com';
  
  try {
      const { data, error } = await supabase
          .from('parties')
          .select(`
              id, display_name, contact_methods,
              people (first_name, last_name)
          `)
          .contains('contact_methods', [{ value: email }]);
          
      if (error) {
          console.error("API Error:", error);
      } else {
          console.log(`Found ${data.length} matches for exact email.`);
          if (data.length > 0) console.log(JSON.stringify(data, null, 2));
      }
      
      // Also check general fetch to ensure table is available
      const { data: all, error: allErr } = await supabase.from('parties').select('id').limit(1);
      if (allErr) {
          console.error("General Fetch Error:", allErr);
      } else {
          console.log("Table 'parties' is accessible. Row count check:", all?.length);
      }

  } catch (e) {
      console.error("Exception:", e);
  }
}
run();
