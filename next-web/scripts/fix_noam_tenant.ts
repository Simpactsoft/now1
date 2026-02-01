import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(
    envConfig.NEXT_PUBLIC_SUPABASE_URL,
    envConfig.SUPABASE_SERVICE_ROLE_KEY
);

async function fixNoam() {
    console.log("--- Fixing Noam's Tenant ---");
    const adminTenant = '00000000-0000-0000-0000-000000000003';

    // 1. Get Noam's ID
    const { data: noam } = await supabase.from('profiles').select('id').eq('email', 'noam@dd.com').single();
    if (!noam) {
        console.error("Noam not found");
        return;
    }

    // 2. Update Tenant
    const { error } = await supabase
        .from('profiles')
        .update({ tenant_id: adminTenant })
        .eq('id', noam.id);

    if (error) console.error("Error updating:", error);
    else console.log("Success! Noam moved to tenant:", adminTenant);
}

fixNoam();
