import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
    const email = 'sales@impactsoft.co.il';

    // Find User ID
    const { data: users, error: uErr } = await supabase.auth.admin.listUsers();
    const user = users?.users.find(u => u.email === email);
    console.log("User:", user?.id);

    if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id);
        console.log("Profile:", profile);

        const { data: tm } = await supabase.from('tenant_members').select('*').eq('user_id', user.id);
        console.log("Tenant Members:", tm);
    }
}
checkRLS();
