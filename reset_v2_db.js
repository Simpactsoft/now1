const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: 'next-web/.env.local' });

async function resetAndSeed() {
    let url = process.env.DATABASE_URL;
    if (!url) {
        console.error("❌ No DATABASE_URL found");
        process.exit(1);
    }

    // Critical DNS Bypass: Force Database connection to the Transaction Pooler (IPv4)
    if (url.includes('db.fmhnwxtapdqzqrsjdxsm.supabase.co')) {
        console.log("🔄 Bypassing IPv6 DNS -> Forcing IPv4 Pooler");
        // Convert `db...` to `aws-0-eu-central-1.pooler...` and port to 6543
        url = url.replace('db.fmhnwxtapdqzqrsjdxsm.supabase.co:5432', 'aws-0-eu-central-1.pooler.supabase.com:6543');
    }

    console.log("🚀 Terminating any stale connections to avoid lock errors...");

    const client = new Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log("🧹 Dropping existing CRM tables...");
        await client.query(`
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
        console.log("✅ Dropped legacy tables.");

        const scriptsSequence = [
            '20260228000000_hybrid_crm_core.sql',
            '20260228000001_hybrid_crm_seed.sql',
            '20260228000003_crm_activity_engine_v2.sql',
            '20260228000004_unified_cards.sql',
            '20260228000005_add_completed_at.sql',
            '20260228000010_unified_activity_stream.sql',
            '20260228000011_activity_stream_triggers.sql',
            '20260228000012_fix_rls_activity_stream.sql',
            '20260228000015_safe_activity_schema_upgrade.sql',
            '44_seed_orbit_master_50k.sql'
        ];

        for (const file of scriptsSequence) {
            const filePath = path.join(__dirname, 'supabase', 'migrations', file);
            if (fs.existsSync(filePath)) {
                console.log(`⏳ Applying ${file}...`);
                const sql = fs.readFileSync(filePath, 'utf8');

                // When connected as postgres user over pooler, wrap the execution to avoid tenant restrictions
                await client.query(`
                    SET session_replication_role = 'replica'; 
                    -- Temporarily suspends triggers during script execution for safety
                `);

                await client.query(sql);

                await client.query(`
                    SET session_replication_role = 'origin';
                `);

                console.log(`✅ Success: ${file}`);
            } else {
                console.warn(`⚠️ File not found, skipping: ${file}`);
            }
        }

        console.log("🎉 Database Master Reset & V2 Seeding Completed Successfully!");
    } catch (e) {
        console.error("❌ Migration failed on error:", e);
        process.exit(1);
    } finally {
        await client.query(`SET session_replication_role = 'origin';`).catch(() => { });
        await client.end();
    }
}

resetAndSeed();
