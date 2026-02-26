require('dotenv').config({ path: 'next-web/.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    console.log("Starting Extensibility migrations...");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const sqlPath1 = path.join(__dirname, 'supabase', 'migrations', '20260301000003_custom_fields_extensibility.sql');
        const sql1 = fs.readFileSync(sqlPath1, 'utf8');

        console.log("Running 20260301000003_custom_fields_extensibility.sql...");
        await client.query(sql1);
        console.log("Successfully ran 20260301000003_custom_fields_extensibility.sql!");

        const sqlPath2 = path.join(__dirname, 'supabase', 'migrations', '20260301000004_automations_webhooks.sql');
        const sql2 = fs.readFileSync(sqlPath2, 'utf8');

        console.log("Running 20260301000004_automations_webhooks.sql...");
        await client.query(sql2);
        console.log("Successfully ran 20260301000004_automations_webhooks.sql!");

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

runMigration();
