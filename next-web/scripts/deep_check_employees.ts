import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmployees() {
    console.log('🧐 Deep checking employees table...');

    // Try to get one row
    const { data, error } = await supabase.from('employees').select('*').limit(1);

    if (error) {
        console.error('Error fetching from employees:', error.message);
    } else {
        console.log('Sample employee:', data);
    }

    const { count, error: countError } = await supabase.from('employees').select('*', { count: 'exact', head: true });
    console.log('Total count from employees:', count);
}

checkEmployees();
