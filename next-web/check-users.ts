import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function listPortalUsers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) { return; }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    console.log("=== PORTAL AUTH USERS ===");
    users?.forEach(u => {
        console.log(`- ${u.email} (last signed in: ${u.last_sign_in_at})`);
    });

    console.log("\n=== RECENTLY UPDATED CARDS ===");
    const { data: cards } = await supabase.from('cards')
        .select('id, email, display_name, job_title, custom_fields, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5);

    cards?.forEach(c => {
        console.log(`- ${c.display_name} (${c.email})`);
        console.log(`  Job Title Col: ${c.job_title}`);
        console.log(`  Role Custom: ${c.custom_fields?.role}`);
        console.log(`  Updated: ${c.updated_at}`);
        console.log("---");
    });
}

listPortalUsers();
