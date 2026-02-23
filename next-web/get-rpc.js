const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    // Get the function definition for fetch_people_crm
    const res = await client.query(`
      SELECT pg_get_functiondef(p.oid)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'fetch_people_crm'
      AND n.nspname = 'public';
    `);
    
    if (res.rows.length > 0) {
      console.log(res.rows[0].pg_get_functiondef);
    } else {
      console.log("Function fetch_people_crm not found in public schema.");
    }
  } catch (e) {
    console.log("Error:", e.message);
  } finally {
    await client.end();
  }
}
check();
