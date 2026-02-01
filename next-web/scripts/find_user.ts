import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(
    envConfig.NEXT_PUBLIC_SUPABASE_URL,
    envConfig.SUPABASE_SERVICE_ROLE_KEY
);

async function findUser(name: string) {
    console.log(`Searching for "${name}" in Profiles...`);
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('email, first_name, last_name, role')
        .or(`first_name.ilike.%${name}%,last_name.ilike.%${name}%`);

    if (profiles && profiles.length > 0) {
        console.log('Found in Profiles:', profiles);
    } else {
        console.log('Not found in Profiles. Searching Auth...');
        const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) {
            console.error(authError);
            return;
        }

        const matches = users.filter(u =>
            u.email?.toLowerCase().includes(name.toLowerCase()) ||
            (u.user_metadata?.full_name || '').toLowerCase().includes(name.toLowerCase()) ||
            (u.user_metadata?.first_name || '').toLowerCase().includes(name.toLowerCase())
        );

        console.log('Found in Auth:', matches.map(u => ({ email: u.email, metadata: u.user_metadata })));
    }
}

findUser('Noam');
