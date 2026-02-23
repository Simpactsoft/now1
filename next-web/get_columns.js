const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:pYg!%2F2cpnFv%2FP88@db.fmhnwxtapdqzqrsjdxsm.supabase.co:5432/postgres" });
(async () => {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'cards'
  `);
  console.log(res.rows);
  await client.end();
})();
