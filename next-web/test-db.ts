import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkDatabaseSave() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) { return; }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const emailToSet = 'impact.art+yosi@gmail.com';

    console.log("1. Current real DB job title...");
    const { data: dbState } = await supabase.from('cards').select('job_title, custom_fields').eq('email', emailToSet).single();
    console.log("Real DB row:", dbState);

    console.log("2. Simulating an RPC Update...");
    const { data: updateRes, error: updateErr } = await supabase.rpc('update_portal_profile', {
        user_email: emailToSet,
        arg_first_name: 'יוסי',
        arg_last_name: 'גולן',
        arg_phone: '+972544530911',
        arg_job_title: 'TEST_JOB_' + Date.now(),
        arg_department: ''
    });
    console.log("RPC Update result:", updateRes, "Error:", updateErr);

    console.log("3. Current DB job title after update...");
    const { data: dbStateAfter } = await supabase.from('cards').select('job_title, custom_fields').eq('email', emailToSet).single();
    console.log("Real DB row after:", dbStateAfter);
}

checkDatabaseSave();
