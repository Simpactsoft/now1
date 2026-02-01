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

async function inspectProfiles() {
    const targetEmail = 'impact.art@gmail.com';
    console.log(`--- Searching for ${targetEmail} ---`);

    // 1. Check Auth
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authError) console.error(authError);

    const authUser = users.find(u => u.email === targetEmail);
    if (authUser) {
        console.log("FOUND IN AUTH:", JSON.stringify({
            id: authUser.id,
            email: authUser.email,
            created_at: authUser.created_at,
            metadata: authUser.user_metadata
        }, null, 2));
    } else {
        console.log("NOT FOUND IN AUTH");
    }

    // 2. Check Profiles
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', targetEmail)
        .single();

    if (profile) {
        console.log("FOUND IN PROFILES:", JSON.stringify(profile, null, 2));
    } else {
        console.log("NOT FOUND IN PROFILES");
    }
}

inspectProfiles();
