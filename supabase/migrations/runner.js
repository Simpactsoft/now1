const fs = require('fs');
const path = require('path');
const pg = require('pg');

const envPath = path.join(process.cwd(), '..', '..', 'next-web', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const match = envContent.match(/^DATABASE_URL=(.*)$/m);
const connectionString = match ? match[1].replace(/["']/g, '').trim() : null;

if (!connectionString) {
    console.error('DATABASE_URL not found in .env.local');
    process.exit(1);
}

const client = new pg.Client({ connectionString: connectionString + '?sslmode=require', ssl: { rejectUnauthorized: false } });

async function run() {
    try {
        await client.connect();

        // 1. Check if there is data in `party_memberships`
        const pmQuery = await client.query('SELECT COUNT(*) FROM party_memberships');
        console.log('party_memberships count:', pmQuery.rows[0].count);
        if (pmQuery.rows[0].count > 0) {
            const sample = await client.query('SELECT * FROM party_memberships LIMIT 5');
            console.log('Sample memberships:', sample.rows);
        }

        // 2. Check what types of relations there are in `relationship_types` (maybe it is populated?)
        const rtQuery = await client.query('SELECT COUNT(*) FROM relationship_types');
        console.log('relationship_types count:', rtQuery.rows[0].count);

        // 3. Look for table names containing relation/connection
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE '%relation%' OR table_name LIKE '%connection%' OR table_name LIKE '%link%')
        `);
        console.log('Potential relationship tables:', tables.rows.map(r => r.table_name));

    } catch (e) {
        console.error("Runner Error:", e);
    } finally {
        await client.end();
    }
}
run();
