const { Client } = require('pg');
require('dotenv').config({ path: './.env.local' });

// We assume there's a DIRECT_URL or DATABASE_URL in .env.local
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
   console.error("No DATABASE_URL or DIRECT_URL found in .env.local");
   process.exit(1);
}

const client = new Client({
   connectionString: connectionString,
   ssl: {
      rejectUnauthorized: false
   }
});

async function runMigration() {
   try {
      await client.connect();
      console.log("Connected to DB. Running DDL...");

      // Using a do block or simply standard drop statements
      const sql = `
        DROP FUNCTION IF EXISTS get_bom_tree(p_product_id UUID, p_version VARCHAR);
        DROP FUNCTION IF EXISTS calculate_bom_cost(p_product_id UUID, p_version VARCHAR);
        NOTIFY pgrst, 'reload schema';
    `;

      await client.query(sql);
      console.log("Migration executed successfully!");

   } catch (err) {
      console.error("Migration error:", err);
   } finally {
      client.end();
   }
}

runMigration();
