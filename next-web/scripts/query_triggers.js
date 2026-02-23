require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  const res = await client.query(`
    select trigger_name, action_statement
    from information_schema.triggers
    where event_object_table = 'cards';
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
check();
