
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

async function inspect() {
    console.log("--- Inspecting 'Emma Miller' ---");

    const { data: cards, error } = await supabase
        .from('cards')
        .select('id, display_name, tenant_id, hierarchy_path')
        .ilike('display_name', '%Emma Miller%')
        .limit(1);

    if (cards && cards.length > 0) {
        const c = cards[0];
        console.log(`Found Card: ${c.display_name}`);
        console.log(`  Tenant: ${c.tenant_id}`);
        console.log(`  Path: ${c.hierarchy_path}`);

        // Compare with Noam (Tenant ...0003)
        const NOAM_TENANT = '00000000-0000-0000-0000-000000000003';
        console.log(`  Match Noam's Tenant? ${c.tenant_id === NOAM_TENANT}`);
    } else {
        console.log("Emma Miller not found in DB (Hidden by RLS? Or doesn't exist?)");
    }

    // Also check total count for Noam's tenant
    const { count } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', '00000000-0000-0000-0000-000000000003');

    console.log(`\nTotal Count for Tenant ...0003 (Stress Test): ${count}`);
}

inspect();
