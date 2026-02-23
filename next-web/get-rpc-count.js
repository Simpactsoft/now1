const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    const res = await client.query(`
      SELECT pg_get_functiondef(p.oid)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'get_people_count'
      AND n.nspname = 'public'
      ORDER BY p.oid DESC LIMIT 1;
    `);
    
    if (res.rows.length > 0) {
      console.log(res.rows[0].pg_get_functiondef);
    } else {
      console.log("Not found.");
    }
  } catch (e) {
    console.log("Error:", e.message);
  } finally {
    await client.end();
  }
}
check();
