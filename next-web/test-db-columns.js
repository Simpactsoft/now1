const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkColumns() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'activities';
        `);
        console.log("Columns in activities table:");
        res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.end();
    }
}

checkColumns();
