import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function auditDatabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) { return; }
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("=== Auditing all records for 'Yosi Golan' ===");

    const { data: yosiCards } = await supabase.from('cards').select('id, display_name, email, job_title, custom_fields').or('display_name.ilike.%יוסי גולן%,email.eq.impact.art+yosi@gmail.com');

    console.log("CARDS FOUND:");
    yosiCards?.forEach(c => {
        console.log(`- ID: ${c.id}`);
        console.log(`  Name: ${c.display_name}`);
        console.log(`  Email: ${c.email}`);
        console.log(`  Job Title Col: ${c.job_title}`);
        console.log(`  Custom Fields Role: ${c.custom_fields?.role}`);
        console.log(`  Custom Fields Job Title: ${c.custom_fields?.job_title}`);
        console.log("---");
    });
}

auditDatabase();
