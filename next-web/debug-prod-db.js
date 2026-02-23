const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("Checking cards for email: impact.art+yosi@gmail.com");
  
  const { data: cards, error: cardsErr } = await supabase.from('cards').select('*');
  if (cardsErr) console.error("Cards Error:", cardsErr);
  
  const foundCards = cards?.filter(c => JSON.stringify(c).includes('yosi') || JSON.stringify(c).includes('impact.art'));
  console.log("Cards containing yosi/impact.art:", JSON.stringify(foundCards, null, 2));
}

run();
