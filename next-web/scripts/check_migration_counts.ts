import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
    console.log('📊 Checking Phase 10 Migration Counts...');

    const { count: partiesCount } = await supabase.from('parties').select('*', { count: 'exact', head: true });
    const { count: peopleCount } = await supabase.from('people').select('*', { count: 'exact', head: true });
    const { count: membershipsCount } = await supabase.from('party_memberships').select('*', { count: 'exact', head: true });

    console.log(`Parties: ${partiesCount}`);
    console.log(`People: ${peopleCount}`);
    console.log(`Memberships: ${membershipsCount}`);

    if (membershipsCount && membershipsCount >= 1250000) {
        console.log('✅ Migration appears complete!');
    } else {
        console.log('⚠️ Migration incomplete or still running.');
    }
}

checkCounts();
