import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const url = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const key = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log(`Checking connection to: ${url}`);

async function checkConnection() {
    try {
        // 1. Simple fetch to the URL (should return 404 or something, but not timeout)
        console.log("1. Testing raw fetch...");
        const res = await fetch(url, { method: 'HEAD' });
        console.log(`   Fetch Status: ${res.status} ${res.statusText}`);
    } catch (e: any) {
        console.error(`   Fetch FAILED: ${e.message}`);
        if (e.cause) console.error("   Cause:", e.cause);
    }

    try {
        // 2. Test Supabase Client connection
        console.log("2. Testing Supabase Client (Auth)...");
        const supabase = createClient(url, key);
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            console.error("   Supabase Auth Error:", error.message);
        } else {
            console.log("   Supabase Auth Success. Session exists?", !!data.session);
        }
    } catch (e: any) {
        console.error(`   Supabase Client FAILED: ${e.message}`);
    }
}

checkConnection();
