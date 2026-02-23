import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables for Next.js actions and Supabase clients
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// We need to polyfill some next/cache stuff because we are running outside Next.js
jestPolyfill();

async function runVerification() {
    console.log("=== STARTING VERIFICATION TEST ===");

    const emailToSet = 'impact.art+yosi@gmail.com';
    const randomSuffix = Math.floor(Math.random() * 10000);
    const testJobTitle = `Chief Testing Officer ${randomSuffix}`;
    const testPhone = `+97250000${randomSuffix}`;

    console.log(`\n[1] Simulating Portal Save.`);
    console.log(`    New Job Title: "${testJobTitle}"`);
    console.log(`    New Phone:     "${testPhone}"`);

    // 1. Simulate the portal action
    const { updatePortalProfile } = require('./src/app/actions/portal-profile-actions');

    // We mock the user returned by createClient inside updatePortalProfile
    // To do this simply without mocking the whole Auth flow, we'll just bypass the UI 
    // and use the admin client to call the RPC directly, mimicking the exact logic.

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    try {
        // Execute the RPC exactly as the server action would
        console.log("    Calling RPC: update_portal_profile...");
        const { data: rpcResult, error: rpcError } = await supabase.rpc('update_portal_profile', {
            user_email: emailToSet,
            arg_first_name: 'יוסי',
            arg_last_name: 'גולן',
            arg_phone: testPhone,
            arg_job_title: testJobTitle,
            arg_department: null
        });

        if (rpcError) {
            console.error("    RPC Failed!", rpcError);
            return;
        }
        console.log(`    RPC Success. Status:`, rpcResult);

        console.log(`\n[2] Verifying Database State...`);

        // Let's check the cards table
        const { data: cardData } = await supabase.from('cards').select('id, job_title, phone, custom_fields, contact_methods').eq('email', emailToSet).single();

        console.log(`    --- CARDS TABLE ---`);
        console.log(`    1. job_title column:         ${cardData?.job_title}`);
        console.log(`    2. phone column:             ${cardData?.phone}`);
        console.log(`    3. custom_fields.role:       ${cardData?.custom_fields?.role}`);

        const cm = cardData?.contact_methods;
        let phoneMethodValue = null;
        if (Array.isArray(cm)) {
            phoneMethodValue = cm.find((m: any) => m.type === 'phone')?.value;
        } else if (cm && typeof cm === 'object') {
            phoneMethodValue = cm.phone;
        }

        console.log(`    4. contact_methods phone:    ${phoneMethodValue || 'NO PHONE FOUND IN JSON'}`);

        if (cardData) {
            // Check party memberships
            const { data: membershipData } = await supabase.from('party_memberships').select('role_name').eq('person_id', cardData.id).single();
            console.log(`    --- PARTY_MEMBERSHIPS TABLE ---`);
            console.log(`    5. role_name column:         ${membershipData?.role_name || 'Not Found'}`);

            console.log(`\n[3] Verification Result:`);
            const roleMatch = cardData.job_title === testJobTitle &&
                cardData.custom_fields?.role === testJobTitle &&
                membershipData?.role_name === testJobTitle;

            const phoneMatch = phoneMethodValue === testPhone && cardData.phone === testPhone;

            if (roleMatch && phoneMatch) {
                console.log(`    ✅ SUCCESS! Role AND Phone synchronized correctly.`);
            } else {
                console.error(`    ❌ FAILED! Fields did not match.`);
                console.error(`       Role Match: ${roleMatch}`);
                console.error(`       Phone Match: ${phoneMatch} (Expected: ${testPhone}, Got JSON: ${phoneMethodValue}, Got Col: ${cardData.phone})`);
            }
        }
    } catch (err) {
        console.error("Verification crashed:", err);
    }
}

function jestPolyfill() {
    // Mock revalidatePath
    require('module').Module._cache[require.resolve('next/cache')] = {
        id: require.resolve('next/cache'),
        filename: require.resolve('next/cache'),
        loaded: true,
        exports: {
            revalidatePath: () => { }
        }
    };
}

runVerification();
