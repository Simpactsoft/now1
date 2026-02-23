const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    // 1. Get raw row for Noam
    console.log("--- RAW ROW ---");
    const raw = await client.query(`
      SELECT id, display_name, first_name, last_name, email 
      FROM cards 
      WHERE display_name ILIKE '%נועם%';
    `);
    console.log(JSON.stringify(raw.rows, null, 2));

    if (raw.rows.length === 0) return;

    // 2. Test the exact SQL condition from the migration
    console.log("\n--- TESTING SEARCH CONDITION ---");
    const searchStr = 'נועם כץ';
    const test = await client.query(`
      SELECT id, display_name 
      FROM cards 
      WHERE display_name ILIKE '%נועם%'
      AND (
            display_name ILIKE $1
            OR coalesce(first_name, '') ILIKE $1
            OR coalesce(last_name, '') ILIKE $1
            OR (coalesce(first_name, '') || ' ' || coalesce(last_name, '')) ILIKE $1
            OR coalesce(email, '') ILIKE $1
      );
    `, ['%' + searchStr + '%']);
    
    console.log(JSON.stringify(test.rows, null, 2));

  } catch (e) {
    console.log("Error:", e.message);
  } finally {
    await client.end();
  }
}
check();
