import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function fixRealJobTitle() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) { return; }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Revert the hardcoded job title
    await supabase.from('cards').update({ job_title: 'CEO' }).eq('id', '90f477f9-128c-4b79-837a-39ac11af645a');
    console.log("Reverted job title.");
}

fixRealJobTitle();
