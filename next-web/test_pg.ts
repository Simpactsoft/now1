import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We extract the DB password from the Supabase URL or assume postgres://postgres:postgres@localhost:5432/postgres if running local supabase CLI
// Actually, local Supabase has a direct DB string: postgresql://postgres:postgres@127.0.0.1:54322/postgres

async function check() {
    const client = new Client({
        connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
    });
    try {
        await client.connect();
        const res = await client.query(`
            SELECT tc.constraint_type, kc.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kc 
              ON tc.constraint_name = kc.constraint_name
            WHERE tc.table_name = 'cards';
        `);
        console.log("Constraints on cards:", res.rows);
    } catch (e) {
        console.error("Local PG connection failed:", e);

        // Try the cloud DB if local fails
        console.log("If the user is running the cloud DB locally, we might need a direct string from them.");
    } finally {
        await client.end();
    }
}
check();
