const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    // We are looking for any string containing נועם in display_name
    console.log("--- FINDING NOAM ---");
    const raw = await client.query(`
      SELECT id, display_name, first_name, last_name, email 
      FROM cards 
      WHERE display_name ILIKE '%נועם%';
    `);
    console.log(JSON.stringify(raw.rows, null, 2));

    if (raw.rows.length === 0) {
      console.log("No noam found trying English?");
       const raw2 = await client.query(`
        SELECT id, display_name, first_name, last_name, email 
        FROM cards 
        WHERE display_name ILIKE '%noam%';
      `);
      console.log(JSON.stringify(raw2.rows, null, 2));
    }


  } catch (e) {
    console.log("Error:", e.message);
  } finally {
    await client.end();
  }
}
check();
