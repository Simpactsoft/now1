
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const TENANT_ID = '00000000-0000-0000-0000-000000000003';

async function checkData() {
    console.log('--- Data Check ---');
    console.log(`Tenant: ${TENANT_ID}`);

    // Count Parties
    const { count: partiesCount, error: partiesError } = await supabase
        .from('parties')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', TENANT_ID)
        .eq('type', 'person');

    if (partiesError) console.error('Parties Error:', partiesError);
    console.log(`Parties Count (Person): ${partiesCount}`);

    // Fetch Latest 5
    const { data: latest, error: lastError } = await supabase
        .from('parties')
        .select('id, display_name, created_at')
        .eq('tenant_id', TENANT_ID)
        .eq('type', 'person')
        .order('created_at', { ascending: false })
        .limit(5);

    if (lastError) console.error('Fetch Error:', lastError);
    else {
        console.log('Latest 5 Persons:');
        console.table(latest);
    }
}

checkData();
