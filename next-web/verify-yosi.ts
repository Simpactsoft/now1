import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkRestAPI() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("Missing SUPABASE URL or KEY");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Let's search by name to see what email is actually saved for "yosi"
    const { data: cardsByName, error: cardNameError } = await supabase.from('cards').select('id, email, first_name, last_name, display_name');
    console.log("All cards:", cardsByName?.length);

    if (cardsByName) {
        const yosiCards = cardsByName.filter((c: any) =>
            (c.display_name && c.display_name.toLowerCase().includes('yosi')) ||
            (c.email && c.email.toLowerCase().includes('yosi')) ||
            (c.first_name && c.first_name.toLowerCase().includes('yosi')) ||
            (c.last_name && c.last_name.toLowerCase().includes('yosi'))
        );
        console.log("Found Yosi Cards:", yosiCards);
    }

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    console.log("Auth users:", authUsers?.users?.map(u => u.email));
}

checkRestAPI();
