const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT display_name, first_name, last_name, email FROM cards WHERE display_name ILIKE '%נועם%';
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.log("Error:", e.message);
  } finally {
    await client.end();
  }
}
check();
