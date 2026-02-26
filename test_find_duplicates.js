const { Pool } = require('pg');
require('dotenv').config({ path: 'next-web/.env.local' });

async function run() {
    const url = 'postgresql://postgres.fmhnwxtapdqzqrsjdxsm:pYg!%2F2cpnFv%2FP88@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
    if (!url) { console.error("No DATABASE_URL"); process.exit(1); }

    const pool = new Pool({ connectionString: url });

    try {
        console.log("Testing find_duplicates RPC...");

        // 1. Get a valid tenant_id from the database
        const tenantRes = await pool.query('SELECT tenant_id FROM cards LIMIT 1');
        if (tenantRes.rows.length === 0) {
            console.log("No cards found to test with.");
            return;
        }
        const tenantId = tenantRes.rows[0].tenant_id;
        console.log("Using tenant:", tenantId);

        // 2. Wrap all calls in a transaction and set current_tenant_id config
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

            // 3. Test exact email match
            console.log("\n--- Test 1: Exact Email Match ---");
            const res1 = await client.query(`
                SELECT * FROM find_duplicates(
                    p_entity_type := 'person',
                    p_email := 'test_exact@example.com'
                )
            `);
            console.log(res1.rows);

            // 4. Test fuzzy name match
            console.log("\n--- Test 2: Fuzzy Name Match ---");
            const res2 = await client.query(`
                SELECT * FROM find_duplicates(
                    p_entity_type := 'person',
                    p_first_name := 'Emanuel',
                    p_last_name := 'Cohen'
                )
            `);
            console.log(res2.rows);

            await client.query('ROLLBACK');
        } finally {
            client.release();
        }

        console.log("\nTests finished.");
    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        await pool.end();
    }
}
run();
