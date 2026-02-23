const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log("Connected to DB.");

    const res = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid)
      FROM pg_constraint
      WHERE conrelid = 'cards'::regclass;
    `);
    console.log("Constraints on cards table:");
    console.table(res.rows);
  } catch (e) {
    // If connection over pg fails, maybe try REST RPC or explain to user
    console.log("Cannot connect directly:", e.message);
  } finally {
    await client.end();
  }
}
check();
