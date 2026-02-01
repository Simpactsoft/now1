
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(
    envConfig.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY
);

async function fixTenantMembers() {
    console.log("--- Syncing Profiles to Tenant Members ---");

    // 1. Fetch all profiles with tenant_id
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, tenant_id, role')
        .not('tenant_id', 'is', null);

    if (error) {
        console.error("Error fetching profiles:", error);
        return;
    }

    console.log(`Found ${profiles.length} profiles.`);

    let added = 0;

    for (const p of profiles) {
        // 2. Upsert into tenant_members
        // We assume 'role' in profile maps to 'role' in member
        const { error: insertError } = await supabase
            .from('tenant_members')
            .upsert({
                tenant_id: p.tenant_id,
                user_id: p.id,
                role: p.role || 'viewer'
            }, { onConflict: 'tenant_id, user_id' }); // Assuming composite PK

        if (insertError) {
            console.error(`Failed to add user ${p.id} to ${p.tenant_id}:`, insertError.message);
        } else {
            added++;
        }
    }

    console.log(`Synced ${added} members.`);
}

fixTenantMembers();
