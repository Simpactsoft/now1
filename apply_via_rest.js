const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: 'next-web/.env.local' });

async function executeViaRest() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error("❌ Missing Supabase URL or Service Role Key");
        process.exit(1);
    }

    console.log("🚀 Executing V2 Reset using Supabase REST API (Bypassing Pooler DNS/Tenant Errors)...");

    const endpoint = `${supabaseUrl}/rest/v1/rpc/exec_sql`;

    async function runSql(sqlQuery) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
                // Crucial for running generic raw SQL if permitted
            },
            body: JSON.stringify({ sql: sqlQuery })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`REST SQL failed: ${response.status} - ${err}`);
        }
    }

    try {
        console.log("🧹 Dropping existing CRM tables...");
        await runSql(`
            DROP TABLE IF EXISTS "activities" CASCADE;
            DROP TABLE IF EXISTS "activity_links" CASCADE;
            DROP TABLE IF EXISTS "activity_participants" CASCADE;
            DROP TABLE IF EXISTS "activity_participants_v2" CASCADE;
            DROP TABLE IF EXISTS "activity_status_history" CASCADE;
            DROP TABLE IF EXISTS "activity_status_definitions" CASCADE;
            DROP TABLE IF EXISTS "commission_ledger" CASCADE;
            DROP TABLE IF EXISTS "commission_rules" CASCADE;
            DROP TABLE IF EXISTS "commission_plans" CASCADE;
        `);
        console.log("✅ Legacy tables dropped.");
    } catch (e) {
        if (e.message.includes('Could not find the function')) {
            console.log("⚠️ The remote DB does not have `exec_sql` enabled for the REST API.");
            console.log("You will need to ask the USER to copy/paste the payload directly into the Supabase SQL Editor web interface.");
            process.exit(2);
        }
        console.error("Execution failed", e.message);
    }
}

executeViaRest();
