import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function mockGetPortalProfile() {
    // 1. Emulate what the UI actually gets in Next.js action
    const emailToSet = 'impact.art+yosi@gmail.com';

    // We can't import the Next.js action easily outside Next.js context without Next.js booting up, 
    // so let's hit the db exactly as the action does using raw Supabase Client.
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profileError } = await supabase.rpc('get_portal_profile', { user_email: emailToSet });

    console.log("=== WHAT THE UI SEES (RPC) ===");
    console.log(profile);

    // If RPC failed, simulate fallback
    if (!profile) {
        console.log("RPC returned null, simulating fallback...");
        const { data: cards } = await supabase.from('cards').select('*').eq('email', emailToSet).limit(1);
        if (cards && cards.length > 0) {
            console.log("=== WHAT THE UI SEES (Fallback cards) ===");
            console.log(cards[0]);
        }
    }
}

mockGetPortalProfile();
