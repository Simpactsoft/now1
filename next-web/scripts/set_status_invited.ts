import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(
    envConfig.NEXT_PUBLIC_SUPABASE_URL,
    envConfig.SUPABASE_SERVICE_ROLE_KEY
);

async function setStatusInvited() {
    const email = 'impact.art@gmail.com';
    console.log(`--- Setting ${email} to 'invited' ---`);

    const { error } = await supabase
        .from('profiles')
        .update({ status: 'invited' })
        .eq('email', email);

    if (error) console.error("Error updating status:", error);
    else console.log("Success! Status updated to 'invited'.");
}

setStatusInvited();
