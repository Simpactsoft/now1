import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function testRLS() {
    console.log("Simulating access as ee693e10-55c5-42ae-8de0-96ebac31e34e");

    // We can test RLS by using the admin client to call a function or issue a raw query with set_config
    // But wait, it's easier to just fetch from the view/function if we have one, or just `createClient` and provide a JWT.
    // Actually, let's use the service role to call a RPC function if one exists, or just manually test `get_my_tenant_id`?

    // Let's create a client with a manually injected session. Since we can't easily do it without a valid JWT,
    // we can use standard email/password login to get a real JWT.

    const client = createClient(supabaseUrl, supabaseKey);
    const { data: authData, error: authErr } = await client.auth.signInWithPassword({
        email: 'sales@impactsoft.co.il',
        password: 'password123!' // Assuming standard test password
    });

    if (authErr && !authData?.session) {
        console.log("Could not login:", authErr);
        // fallback test
        return;
    }

    console.log("Logged in. UID:", authData.user?.id);
    const { data: profiles, error: pErr } = await client.from('profiles').select('tenant_id');
    console.log("Profiles visible to this user:", profiles, pErr);

    const { data: acts, error: aErr } = await client.from('activity_stream').select('*');
    console.log("Activities visible:", acts?.length, aErr);
}
testRLS();
