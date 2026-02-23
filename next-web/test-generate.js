const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: 'test@example.com',
    options: { redirectTo: 'http://localhost:3000/auth/callback?next=/portal/dashboard' }
  });
  console.log(data?.properties?.action_link, error);
}
test();
