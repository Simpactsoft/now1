const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
      console.log("No DB URL found.");
      return;
  }
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
      await client.query("NOTIFY pgrst, 'reload schema';");
      console.log("Schema reloaded successfully!");
  } catch (e) {
      console.error("Schema reload failed:", e);
  } finally {
      await client.end();
  }
}
run();
