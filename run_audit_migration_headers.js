require('dotenv').config({ path: 'next-web/.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    console.log("Starting Headers update migration...");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260301000002_audit_trail_headers.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Running 20260301000002_audit_trail_headers.sql...");
        await client.query(sql);
        console.log("Successfully ran 20260301000002_audit_trail_headers.sql!");

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

runMigration();
