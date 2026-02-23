require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect().then(() => {
  client.query("SELECT id, email, first_name, last_name, display_name, phone, contact_methods FROM cards WHERE display_name LIKE '%דנה%';").then(res => {
    console.log(JSON.stringify(res.rows, null, 2));
    client.end();
  }).catch(e => {
    console.error(e);
    client.end();
  });
}).catch(e => console.error("Connect error:", e));
