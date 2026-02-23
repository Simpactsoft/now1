import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function syncYosi() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) { return; }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const emailToSet = 'impact.art+yosi@gmail.com';

    // Get current record
    const { data: dbState } = await supabase.from('cards').select('id, job_title, custom_fields').eq('email', emailToSet).single();
    if (dbState) {
        // Sync role to job_title
        const custom_fields = dbState.custom_fields || {};
        custom_fields.role = dbState.job_title;

        await supabase.from('cards').update({ custom_fields }).eq('id', dbState.id);
        console.log("Forced sync via REST API. Both columns now match:", dbState.job_title);
    }
}

syncYosi();
