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

async function fixImpactArt() {
    const email = 'impact.art@gmail.com';
    const adminTenant = '00000000-0000-0000-0000-000000000003';

    console.log(`--- Fixing ${email} ---`);

    // 1. Get Auth ID
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const user = users.find(u => u.email === email);

    if (!user) {
        console.error("User not found in Auth!");
        return;
    }

    // 2. Insert Profile
    // We don't know the exact role intended, defaulting to 'agent'. Admin can change it.
    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            tenant_id: adminTenant,
            role: 'agent', // Default safest role
            email: email,
            first_name: '',
            last_name: ''
        });

    if (error) console.error("Error creating profile:", error);
    else console.log("Success! Profile created for:", email);
}

fixImpactArt();
