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

    const emailToSet = 'impact.art+yosi@gmail.com';

    // Get any random person card
    const { data: randCards, error: cardFindError } = await supabase
        .from('cards')
        .select('id, card_type, display_name, email, first_name, last_name, metadata')
        .eq('card_type', 'individual')
        .limit(1);

    if (randCards && randCards.length > 0) {
        const target = randCards[0];
        console.log("Adding Yosi's email to:", target);

        const { error: updateError } = await supabase
            .from('cards')
            .update({
                email: emailToSet,
                first_name: 'יוסי',
                last_name: 'גולן',
                display_name: 'יוסי גולן',
                job_title: 'סמנכ"ל טכנולוגיות',
                metadata: {
                    ...target.metadata,
                    job_title: 'סמנכ"ל טכנולוגיות',
                    department: 'הנהלה'
                }
            })
            .eq('id', target.id);

        console.log("Update error?", updateError);

        // Run the getter again to verify
        const { data: rpcData } = await supabase.rpc('get_portal_profile', { user_email: emailToSet });
        console.log("Result of RPC:", rpcData);
    }
}

checkRestAPI();
