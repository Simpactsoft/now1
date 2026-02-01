
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

async function resetData() {
    const tenantId = '00000000-0000-0000-0000-000000000003'; // Galactic Stress Test
    console.log(`--- RESETTING DATA FOR TENANT: ${tenantId} ---`);

    // Delete Cards
    const { error: err1, count } = await supabase
        .from('cards')
        .delete({ count: 'exact' })
        .eq('tenant_id', tenantId);

    if (err1) {
        console.error("Error deleting cards:", err1);
    } else {
        console.log(`Deleted ${count} cards.`);
    }

    console.log("--- RESET COMPLETE ---");
}

resetData();
