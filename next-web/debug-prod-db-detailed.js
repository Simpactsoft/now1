const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // 1. Fetch ALL parties to scan manually
  const { data: parties, error: pErr } = await supabase.from('parties').select('id, display_name, contact_methods');
  if (pErr) console.error("Parties Error:", pErr);
  
  console.log(`Total parties in DB: ${parties?.length}`);
  
  // Output any party containing "yosi" or "impact.art" ignoring case
  const found = parties?.filter(p => {
    const str = JSON.stringify(p).toLowerCase();
    return str.includes('yosi') || str.includes('impact.art');
  });
  
  console.log("Found Parties:", JSON.stringify(found, null, 2));

  // 2. Fetch ALL cards to scan manually
  const { data: cards, error: cErr } = await supabase.from('cards').select('id, display_name, email');
  if (cErr) console.error("Cards Error:", cErr);
  
  const foundCards = cards?.filter(c => {
    const str = JSON.stringify(c).toLowerCase();
    return str.includes('yosi') || str.includes('impact.art');
  });
  
  console.log("Found Cards:", JSON.stringify(foundCards, null, 2));
}

run();
