const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: 'impact.art+yosi@gmail.com',
    options: { redirectTo: 'http://localhost:3000/portal/login' }
  });
  console.log("Token Hash:", data.properties.action_link);
}
run();
