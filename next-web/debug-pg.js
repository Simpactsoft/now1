const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
      console.log("No exact DB URL found to bypass API cache.");
      return;
  }
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
      // 1. Check legacy cards
      const res = await client.query(`SELECT id, display_name, email FROM cards WHERE email ILIKE $1 OR email ILIKE $2`, ['%yosi%', '%impact.art%']);
      console.log("Found in cards:", res.rows);
      
      // 2. Check parties and people
      const res2 = await client.query(`
        SELECT p.id, p.display_name, p.contact_methods, pp.first_name, pp.last_name 
        FROM parties p
        LEFT JOIN people pp ON pp.party_id = p.id
        WHERE p.display_name ILIKE $1 OR pp.first_name ILIKE $1
      `, ['%yosi%']);
      console.log("Found in modern tables by name:", res2.rows);
      
  } catch (e) {
      console.error("Query failed:", e);
  } finally {
      await client.end();
  }
}
run();
