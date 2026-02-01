import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// [FIX] Point to next-web/.env.local
dotenv.config({ path: path.join(process.cwd(), "next-web", ".env.local") });

async function debugRPC() {
    console.log("Loading env from:", path.join(process.cwd(), "next-web", ".env.local"));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);


    console.log("Inspecting 'parties' table...");
    const { data: parties, error: err1 } = await supabase.from('parties').select('*').limit(1);
    if (err1) console.error("Parties fetch failed:", err1);
    else if (parties) console.log("Parties found. Columns:", Object.keys(parties[0] || {}));

    console.log("Inspecting 'cards' table/view...");
    const { data: cards, error: err2 } = await supabase.from('cards').select('*').limit(1);
    if (err2) console.error("Cards fetch failed:", err2);
    else if (cards) console.log("Cards found. Columns:", Object.keys(cards[0] || {}));
}

debugRPC().catch(console.error);
