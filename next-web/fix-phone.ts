import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function fixYosiUser() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("Missing SUPABASE URL or KEY");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const emailToSet = 'impact.art+yosi@gmail.com';

    // 1. Try to find the card
    const { data: allCards, error: getErr } = await supabase.from('cards').select('*').eq('email', emailToSet).limit(1);

    if (allCards && allCards.length > 0) {
        const target = allCards[0];
        console.log("Found an existing card. Updating phone number...", target.id);

        const { data: updated, error: updateErr } = await supabase
            .from('cards')
            .update({
                phone: '054-1234567',
                contact_methods: [
                    { type: 'email', value: emailToSet },
                    { type: 'phone', value: '054-1234567' }
                ]
            })
            .eq('id', target.id)
            .select();

        console.log("Update result:", updated, "Error:", updateErr);
    }
}

fixYosiUser();
