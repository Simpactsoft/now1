import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugJobTitle() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) { return; }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const emailToSet = 'impact.art+yosi@gmail.com';

    // 1. Get current state via RPC
    const { data: beforeRPC } = await supabase.rpc('get_portal_profile', { user_email: emailToSet });
    console.log("State BEFORE:", beforeRPC?.job_title);

    // 2. Fetch the raw card record to see what it looks like before
    const cardId = beforeRPC?.id;
    if (cardId) {
        const { data: rawCardBefore } = await supabase.from('cards').select('job_title, metadata').eq('id', cardId).single();
        console.log("Raw Card BEFORE:", rawCardBefore);
    }

    // 3. Simulate updating via RPC
    console.log("Simulating update to 'Chief Imagination Officer'...");
    const { data: updateRes, error: updateErr } = await supabase.rpc('update_portal_profile', {
        user_email: emailToSet,
        arg_first_name: beforeRPC?.first_name || 'Yosi',
        arg_last_name: beforeRPC?.last_name || 'Golan',
        arg_phone: beforeRPC?.phone || '',
        arg_job_title: 'Chief Imagination Officer',
        arg_department: ''
    });

    console.log("Update Error:", updateErr, "Update Res:", updateRes);

    // 4. Get state after
    const { data: afterRPC } = await supabase.rpc('get_portal_profile', { user_email: emailToSet });
    console.log("State AFTER RPC:", afterRPC?.job_title);

    if (cardId) {
        const { data: rawCardAfter } = await supabase.from('cards').select('job_title, metadata').eq('id', cardId).single();
        console.log("Raw Card AFTER:", rawCardAfter);
    }
}

debugJobTitle();
