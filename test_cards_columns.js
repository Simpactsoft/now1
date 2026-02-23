require('dotenv').config({ path: 'next-web/.env.local' });
const { Client } = require('pg');

async function queryDB() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'cards'
            ORDER BY ordinal_position;
        `);

        console.table(res.rows);
    } catch (e) {
        console.error("Query failed:", e);
    } finally {
        await client.end();
    }
}

queryDB();
