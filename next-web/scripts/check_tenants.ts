import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenants() {
    console.log('🏘️ Checking parties by tenant...');

    const { data, error } = await supabase.from('parties').select('tenant_id');

    if (error) {
        console.error('Error fetching parties:', error.message);
        return;
    }

    const tenantCounts: Record<string, number> = {};
    data.forEach(p => {
        tenantCounts[p.tenant_id] = (tenantCounts[p.tenant_id] || 0) + 1;
    });

    console.log('Tenant Counts in parties:', tenantCounts);
}

checkTenants();
