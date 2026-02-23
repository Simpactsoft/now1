const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("Connected to DB.");

  const sql = fs.readFileSync('../supabase/migrations/20260222160000_portal_shareable_tokens.sql', 'utf8');
  await client.query(sql);
  
  // Reload schema cache (Supabase specific)
  try {
     await client.query("NOTIFY pgrst, 'reload schema'");
     console.log("Schema cache reloaded.");
  } catch (e) {
     console.log("Could not reload schema cache automatically:", e.message);
  }

  console.log("Migration applied successfully!");
  await client.end();
}
run().catch(console.error);
