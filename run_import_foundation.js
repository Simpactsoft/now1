const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: 'next-web/.env.local' });

async function run() {
    const url = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL; // just in case
    if (!process.env.DATABASE_URL) { console.error("No DATABASE_URL found in next-web/.env.local"); process.exit(1); }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const sql = fs.readFileSync('supabase/migrations/20260301000009_import_system_foundation.sql', 'utf8');

    try {
        await pool.query(sql);
        console.log("Migration 20260301000009_import_system_foundation successful");
    } catch (e) {
        console.error("Migration failed:", e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
run();
