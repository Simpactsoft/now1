
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(
    envConfig.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY
);

async function debugProfile() {
    console.log("--- Debugging Noam's Profile ---");

    // 1. Find Auth User by Email (User said "Noam Cohen", guessing email or finding via list)
    // I'll list users to find him.
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error("List Users Error:", listError);
        return;
    }

    // Look for 'noam' in email
    const noam = users.find(u => u.email?.includes('noam') || u.user_metadata?.name?.includes('Noam'));

    if (!noam) {
        console.error("Could not find user 'Noam' in Auth.");
        console.log("Available Emails:", users.map(u => u.email));
        return;
    }

    console.log(`Found Auth User: ${noam.email} (ID: ${noam.id})`);

    // 2. Check Profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', noam.id) // Check strict ID match first
        .maybeSingle();

    if (profileError) {
        console.error("Profile Fetch Error:", profileError);
    } else if (!profile) {
        console.error("Creating WARNING: No PROFILE found for this Auth ID!");

        // Check if profile exists with email but different ID?
        const { data: mismatchProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', noam.email)
            .maybeSingle();

        if (mismatchProfile) {
            console.log("Wait! Found a profile with same Email but different ID:", mismatchProfile.id);
            console.log("This confirms the ID Mismatch theory.");
        } else {
            console.log("No profile with that email either.");
        }
    } else {
        console.log("Profile Found:", profile);
        console.log("Profile Tenant ID:", profile.tenant_id);

        // Check Tenant Name
        if (profile.tenant_id) {
            const { data: tenant } = await supabase.from('tenants').select('name').eq('id', profile.tenant_id).single();
            console.log("Tenant Name:", tenant?.name);

            // Test RPC Logic manually
            console.log("Testing SQL logic for get_my_tenants matches...");
            if (profile.tenant_id && profile.id === noam.id) {
                console.log("get_my_tenants SHOULD return this tenant.");
            }
        } else {
            console.error("ERROR: Profile has NO tenant_id!");
        }
    }
}

debugProfile();
