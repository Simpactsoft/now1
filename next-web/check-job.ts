import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkRealJobTitle() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) { return; }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: realCardData } = await supabase.from('cards').select('*').eq('id', '90f477f9-128c-4b79-837a-39ac11af645a').single();

    console.log("Real Card Data:", realCardData);
}

checkRealJobTitle();
