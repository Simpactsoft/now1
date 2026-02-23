const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const targetId = "b9c0fe56-82fe-45f8-b30a-20d0fb90ba7f"; // example from user if they had one, I'll just check if party_id is missing from cards schema

  console.log("Checking how parties map to cards...");
  const { data, error } = await supabase.from('parties').select('*').limit(1);
  if (error) console.error("Parties ERROR:", error);
  else console.log("Parties keys:", Object.keys(data[0] || {}));
  
  const { data: d2, error: e2 } = await supabase.rpc('fetch_person_profile', { arg_tenant_id: 'a1b1c1d1-e1f1-4111-8111-111111111111', arg_person_id: targetId }).limit(1);
  console.log("RPC Error?", e2);
}
check();
