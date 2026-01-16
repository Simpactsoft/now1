import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectData() {
    console.log('🔍 Inspecting Data...');

    const { data: types } = await supabase.from('parties').select('type').limit(1000);
    const personCount = await supabase.from('parties').select('*', { count: 'exact', head: true }).eq('type', 'person');
    const orgCount = await supabase.from('parties').select('*', { count: 'exact', head: true }).eq('type', 'organization');

    console.log(`Person Parties: ${personCount.count}`);
    console.log(`Organization Parties: ${orgCount.count}`);

    const { data: employees } = await supabase.from('employees').select('id').limit(1);
    console.log(`Sample Employee ID: ${employees?.[0]?.id}`);

    if (employees?.[0]?.id) {
        const { data: partyMatch } = await supabase.from('parties').select('id').eq('id', employees[0].id).single();
        console.log(`Employee ID matches Party ID: ${!!partyMatch}`);
    }
}

inspectData();
