require('dotenv').config({ path: 'next-web/.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    console.log("Starting migration...");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const sqlPath1 = path.join(__dirname, 'supabase', 'migrations', '20260228000010_unified_activity_stream.sql');
        const sql1 = fs.readFileSync(sqlPath1, 'utf8');

        // Execute script 1
        console.log("Running 20260228000010_unified_activity_stream.sql...");
        await client.query(sql1);
        console.log("Successfully ran 20260228000010_unified_activity_stream.sql!");

        const sqlPath2 = path.join(__dirname, 'supabase', 'migrations', '20260228000011_activity_stream_triggers.sql');
        const sql2 = fs.readFileSync(sqlPath2, 'utf8');

        // Execute script 2
        console.log("Running 20260228000011_activity_stream_triggers.sql...");
        await client.query(sql2);
        console.log("Successfully ran 20260228000011_activity_stream_triggers.sql!");

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

runMigration();
