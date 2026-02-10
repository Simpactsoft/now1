
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = 'postgresql://postgres:postgres@localhost:54322/postgres';

async function runMigration() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const sql = `
            CREATE OR REPLACE FUNCTION public.set_config(name text, value text)
            RETURNS void
            LANGUAGE plpgsql
            AS $$
            BEGIN
              PERFORM set_config(name, value, false);
            END;
            $$;
        `;
        await client.query(sql);
        console.log('Migration successful: set_config RPC created.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
