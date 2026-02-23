const fs = require('fs');
const { Client } = require('pg');

async function run() {
    const connectionString = 'postgresql://postgres.fmhnwxtapdqzqrsjdxsm:pYg!%2F2cpnFv%2FP88@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

    console.log("Connecting to Supabase IPv4 Pooler...");
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected via Pooler successfully!');

        console.log('Reading migration file...');
        const sql = fs.readFileSync('../supabase/migrations/20260228000002_task_management_columns.sql', 'utf8');

        console.log('Executing migration query...');
        await client.query(sql);
        console.log('Migration successfully applied to remote database!');
    } catch (e) {
        console.error('Migration failed:', e.message);
    } finally {
        await client.end();
    }
}

run();
