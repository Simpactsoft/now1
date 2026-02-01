
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(
    envConfig.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY
);

async function listTables() {
    console.log("--- Listing Public Tables ---");
    // We can't query information_schema easily with JS client (RLS/Permissions often block it for non-postgres)
    // But we can try to inspect a few likely candidates:
    // tenants, organizations, accounts, companies

    const candidates = ['tenants', 'organizations', 'accounts', 'companies', 'saas_tenants'];

    for (const table of candidates) {
        const { data, error } = await supabase.from(table).select('*').limit(5);
        if (!error) {
            console.log(`[FOUND] Table '${table}' exists.`);
            console.log(data);
        } else {
            // console.log(`[MISSING] Table '${table}' not found (or error: ${error.message})`);
        }
    }

    // Check specific tenant from previous step
    const targetId = '4d145b9e-4a75-5567-a0af-bcc4a30891e5';
    const { data: tData } = await supabase.from('tenants').select('name').eq('id', targetId).single();
    if (tData) {
        console.log(`\n[LOOKUP] Tenant ${targetId} is named: "${tData.name}"`);
    } else {
        console.log(`\n[LOOKUP] Tenant ${targetId} not found.`);
    }
}

listTables();
