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
            SELECT id, internal_code, label_i18n 
            FROM option_values 
            WHERE option_set_id IN (SELECT id FROM option_sets WHERE code = 'PERSON_STATUS');
        `);

        console.log("PERSON_STATUS values:");
        console.table(res.rows);

        const cardRes = await client.query(`
            SELECT id, type, status, custom_fields->>'status' as cf_status
            FROM cards
            WHERE type = 'person'
            LIMIT 5;
        `);

        console.log("CARDS sample:");
        console.table(cardRes.rows);

    } catch (e) {
        console.error("Query failed:", e);
    } finally {
        await client.end();
    }
}

queryDB();
