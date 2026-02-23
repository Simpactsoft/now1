const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runTest() {
    const email = 'impact.art+yosi@gmail.com';
    const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
    
    console.log("Checking DB Connection Variables...");
    console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
    console.log("DIRECT_URL exists:", !!process.env.DIRECT_URL);
    console.log("Active DB URL starts with postgres:", dbUrl?.startsWith('postgres'));

    if (!dbUrl || !dbUrl.startsWith('postgres')) {
        console.error("CRITICAL: No valid postgres DB URL found. Fallback won't work in prod.");
        return;
    }

    try {
        const client = new Client({
            connectionString: dbUrl,
            ssl: { rejectUnauthorized: false }
        });
        
        console.log("Attempting direct connection...");
        await client.connect();
        console.log("Connection successful!");

        // 1. Broad test first - any email in parties
        const broad = await client.query(`
            SELECT p.id, p.contact_methods, pp.first_name, pp.last_name 
            FROM parties p
            LEFT JOIN people pp ON pp.party_id = p.id
            WHERE p.contact_methods::text ILIKE $1
        `, [`%${email}%`]);
        console.log(`Broad search found ${broad.rows.length} rows.`);
        if (broad.rows.length > 0) console.log(JSON.stringify(broad.rows, null, 2));

        // 2. Exact test used in action
        const exact = await client.query(`
            SELECT p.id, p.display_name, p.avatar_url, p.contact_methods, 
                   pp.first_name, pp.last_name, pp.gender
            FROM parties p
            LEFT JOIN people pp ON pp.party_id = p.id
            WHERE p.contact_methods @> $1::jsonb
            LIMIT 1
        `, [JSON.stringify([{ value: email }])]);
        
        console.log(`Exact JSON search found ${exact.rows.length} rows.`);

        await client.end();
    } catch (e) {
        console.error("Connection/Query Error:", e);
    }
}

runTest();
