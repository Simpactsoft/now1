import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function applyAndTest() {
    const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
    if (!dbUrl) {
        console.error("No DB URL found");
        return;
    }

    const pgClient = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });

    await pgClient.connect();

    try {
        const sql = fs.readFileSync(path.resolve(process.cwd(), '../supabase/migrations/20260221160000_portal_profile_auth_adapter.sql'), 'utf-8');
        await pgClient.query(sql);
        console.log("Applied SQL successfully.");
    } catch (e) {
        console.error("Error applying SQL:", e);
    } finally {
        await pgClient.end();
    }

    // Now test it
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const emailToSet = 'impact.art+yosi@gmail.com';

    console.log("Simulating update to 'VP Product'...");
    const { data: updateRes, error: updateErr } = await supabase.rpc('update_portal_profile', {
        user_email: emailToSet,
        arg_first_name: 'יוסי',
        arg_last_name: 'גולן',
        arg_phone: '+972544530911',
        arg_job_title: 'VP Product',
        arg_department: ''
    });

    console.log("Update Error:", updateErr, "Update Res:", updateRes);

    const { data: afterRPC } = await supabase.rpc('get_portal_profile', { user_email: emailToSet });
    console.log("State AFTER RPC:", afterRPC?.job_title);
}

applyAndTest();
