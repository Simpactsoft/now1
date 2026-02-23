const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: cards } = await supabase.from('cards').select('id, email, type').eq('email', 'impact.art+yosi@gmail.com');
  console.log("CARDS:", cards);
  const { data: people } = await supabase.from('people').select('id, email').eq('email', 'impact.art+yosi@gmail.com');
  console.log("PEOPLE:", people);
}
run();
