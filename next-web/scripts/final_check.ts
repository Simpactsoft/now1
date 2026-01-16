import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function finalCheck() {
    console.log('✅ Final Migration Check...');

    const { count: personCount } = await supabase.from('parties').select('*', { count: 'exact', head: true }).eq('type', 'person');
    const { count: peopleCount } = await supabase.from('people').select('*', { count: 'exact', head: true });
    const { count: membershipsCount } = await supabase.from('party_memberships').select('*', { count: 'exact', head: true });

    console.log(`Person Parties: ${personCount}`);
    console.log(`People records: ${peopleCount}`);
    console.log(`Memberships: ${membershipsCount}`);
}

finalCheck();
