import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- Checking Tenants ---');
    const { data: tenants } = await supabase.from('tenants').select('id, name');
    console.log('Tenants:', tenants);

    console.log('\n--- Checking Pipelines ---');
    const { data: pipelines } = await supabase.from('pipelines').select('id, name, tenant_id');
    console.log('Pipelines:', pipelines);
}

check().catch(console.error);
