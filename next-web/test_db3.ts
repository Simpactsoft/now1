import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function testAuthRLS() {
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: 'sales@impactsoft.co.il'
    });

    // Actually, we can just sign in with password if we know it, or use service role to impersonate
    // Instead of auth, let's just create admin client and do a set_config or override the token?
    // Easier: query `activity_stream` with service role to confirm data count
    console.log("Service Role Query for 1295b662-fa20-40fd-abbb-3cd913f66af1:");
    const { data: srData } = await adminClient
        .from('activity_stream')
        .select('*')
        .eq('entity_id', '1295b662-fa20-40fd-abbb-3cd913f66af1');

    console.log(`SR found ${srData?.length} items.`);
}
testAuthRLS();
