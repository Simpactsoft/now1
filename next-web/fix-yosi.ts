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

    // 1. Try to find an existing card
    const { data: allCards, error: getErr } = await supabase.from('cards').select('*').limit(1);

    if (getErr) {
        console.error("Error fetching any cards:", getErr);
        return;
    }

    if (!allCards || allCards.length === 0) {
        console.log("No cards found AT ALL. Let's insert a completely new one for Yosi.");

        // Let's get a tenant_id from auth users maybe? Or just use a known default one.
        // Actually, cards require a tenant_id. Let's find one.
        const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
        if (!tenants || tenants.length === 0) {
            console.log("No tenants. Can't insert card.");
            return;
        }

        const newCard = {
            tenant_id: tenants[0].id,
            email: emailToSet,
            first_name: 'יוסי',
            last_name: 'גולן',
            display_name: 'יוסי גולן פורטל',
            job_title: 'לקוח VIP',
            card_type: 'individual'
        };

        const { data: inserted, error: insertErr } = await supabase.from('cards').insert([newCard]).select();
        console.log("Insert result:", inserted, "Error:", insertErr);
    } else {
        const target = allCards[0];
        console.log("Found an existing card. Updating it to Yosi's email.", target.id);

        const { data: updated, error: updateErr } = await supabase
            .from('cards')
            .update({
                email: emailToSet,
                first_name: 'יוסי',
                last_name: 'גולן',
                display_name: 'יוסי גולן',
                job_title: 'מנכ"ל טכנולוגיות'
            })
            .eq('id', target.id)
            .select();

        console.log("Update result:", updated, "Error:", updateErr);
    }

    console.log("Double checking RPC now that the database has been modified...");
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_portal_profile', { user_email: emailToSet });
    console.log("RPC Check Result:", 'Data:', rpcData, 'Error:', rpcError);
}

fixYosiUser();
