import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function fixRealYosi() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("Missing SUPABASE URL or KEY");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Revert the fake card's Email back to something random so it no longer triggers the portal match
    console.log("Reverting fake test card...");
    await supabase.from('cards')
        .update({ email: 'do_not_use@test.com', first_name: null, last_name: null, job_title: null, display_name: 'Test Organization' })
        .eq('id', '78b4bfea-f746-422d-b885-6edac8726eb2');

    // 2. Fetch the real Yosi card
    console.log("Promoting the REAL Yosi card...");
    const { data: realCardData } = await supabase.from('cards').select('*').eq('id', '90f477f9-128c-4b79-837a-39ac11af645a').single();

    if (realCardData) {
        // The real card has contact_methods: { email: '...', phone: '...' }
        // We will lift these to the top level 'email' and 'phone' columns so the Portal API can find them.
        let cm: any = {};
        if (realCardData.contact_methods && typeof realCardData.contact_methods === 'object') {
            cm = realCardData.contact_methods;
            if (Array.isArray(cm)) {
                // If it's an array, try to extract value
                cm = null;
            }
        }

        const extractedEmail = cm?.email || 'impact.art+yosi@gmail.com';
        const extractedPhone = cm?.phone || '+972544530911';

        await supabase.from('cards')
            .update({
                email: extractedEmail,
                phone: extractedPhone,
                first_name: 'יוסי',
                last_name: 'גולן',
                job_title: 'סמנכ"ל טכנולוגיות' // Setting the correct title based on user complaint
            })
            .eq('id', '90f477f9-128c-4b79-837a-39ac11af645a');

        console.log(`Updated real card with email ${extractedEmail} and phone ${extractedPhone}`);
    }
}

fixRealYosi();
