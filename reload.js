const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:pYg!%2F2cpnFv%2FP88@db.fmhnwxtapdqzqrsjdxsm.supabase.co:5432/postgres'
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to DB');
        await client.query("NOTIFY pgrst, 'reload schema'");
        console.log('Schema reload triggered successfully');
    } catch (err) {
        console.error('Error reloading schema', err);
    } finally {
        await client.end();
    }
}

run();
