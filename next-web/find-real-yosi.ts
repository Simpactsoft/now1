import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function findRealYosi() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("Missing SUPABASE URL or KEY");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the REAL Yosi Golan
    const { data: realYosiCards, error } = await supabase
        .from('cards')
        .select('*')
        .ilike('display_name', '%יוסי גולן%');

    console.log("Found Yosi Candidates:");
    realYosiCards?.forEach(c => {
        console.log(`- ID: ${c.id}`);
        console.log(`  Name: ${c.display_name}`);
        console.log(`  Email: ${c.email}`);
        console.log(`  Phone: ${c.phone}`);
        console.log(`  Job Title: ${c.job_title}`);
        console.log(`  Metadata:`, c.metadata);
        console.log(`  Contact Methods:`, c.contact_methods);
        console.log("---");
    });
}

findRealYosi();
