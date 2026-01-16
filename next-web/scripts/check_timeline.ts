import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTimeline() {
    console.log('🕵️ Checking Action Timeline status...');

    // Check if table exists by trying to select from it
    const { count, error } = await supabase
        .from('action_timeline')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('❌ Error accessing action_timeline:', error.message);
        if (error.code === '42P01') {
            console.log('👉 The table "action_timeline" does NOT exist. You presumably did not run migration 27.');
        }
        return;
    }

    console.log(`✅ Table "action_timeline" exists.`);
    console.log(`📊 Total events: ${count}`);

    if (count === 0) {
        console.log('⚠️ The table is empty. Seeding was skipped or failed.');
    } else {
        console.log('✨ Data exists. The issue might be that the specific person viewed has no events (sample size too small).');
    }
}

checkTimeline();
