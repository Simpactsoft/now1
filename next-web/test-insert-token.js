const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Get a random tenant and card
  const { data: cards } = await supabase.from('cards').select('id, tenant_id').limit(1);
  if (!cards || cards.length === 0) return console.log("No cards found");
  
  const target = cards[0];
  console.log("Attempting insert for card:", target.id);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const { error } = await supabase.from('portal_tokens').insert({
      token_hash: 'testhash12345',
      tenant_id: target.tenant_id,
      card_id: target.id,
      expires_at: expiresAt.toISOString()
  });
  
  console.log("Insert Error:", error);
  
  // Cleanup test
  if (!error) await supabase.from('portal_tokens').delete().eq('token_hash', 'testhash12345');
}
check();
