import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log('📡 Checking Table Existence and visibility...');

    // Check employees
    const { count: employeesCount, error: empError } = await supabase.from('employees').select('*', { count: 'exact', head: true });
    console.log(`Employees Table: ${empError ? 'ERROR: ' + empError.message : employeesCount}`);

    // Check parties
    const { count: partiesCount, error: partiesError } = await supabase.from('parties').select('*', { count: 'exact', head: true });
    console.log(`Parties Table: ${partiesError ? 'ERROR: ' + partiesError.message : partiesCount}`);

    // Check people
    const { count: peopleCount, error: peopleError } = await supabase.from('people').select('*', { count: 'exact', head: true });
    console.log(`People Table: ${peopleError ? 'ERROR: ' + peopleError.message : peopleCount}`);

    // Check memberships
    const { count: membershipsCount, error: membershipsError } = await supabase.from('party_memberships').select('*', { count: 'exact', head: true });
    console.log(`Memberships Table: ${membershipsError ? 'ERROR: ' + membershipsError.message : membershipsCount}`);
}

checkTables();
