const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const url = process.env.DATABASE_URL;
    if (!url) { console.error("No DATABASE_URL"); process.exit(1); }
    
    const pool = new Pool({ connectionString: url });
    const sql = fs.readFileSync('supabase/migrations/20260228000002_task_management_columns.sql', 'utf8');
    
    try {
        await pool.query(sql);
        console.log("Migration successful");
    } catch(e) {
        console.error("Migration failed:", e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
run();
