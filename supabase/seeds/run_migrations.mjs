/**
 * Apply Pending Migrations via Direct PostgreSQL Connection
 * 
 * Usage: node supabase/seeds/run_migrations.mjs
 * 
 * Requires: npm install pg (will be installed automatically)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Supabase connection string (pooler mode for cloud)
// Format: postgresql://postgres.[ref]:[password]@[host]:6543/postgres
const DATABASE_URL = process.env.DATABASE_URL ||
    'postgresql://postgres.fmhnwxtapdqzqrsjdxsm:' +
    process.env.SUPABASE_DB_PASSWORD +
    '@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

// Migration files in dependency order
const MIGRATIONS = [
    '20260219_financial_reports.sql',
    '20260219_multi_warehouse.sql',
    '20260219_quotes_table.sql',
    '20260219_invoice_generation.sql',
    '20260220_price_lists.sql',
    '20260221_product_variants.sql',
    '20260222_profitability_validator.sql',
    '20260220_invoice_account_fix.sql',
    '20260220_purchase_orders.sql',
    '20260220_payment_tracking.sql',
    '20260220_account_type_resolution.sql',
    '20260224_atomic_journal_entry.sql',
    '20260225_rpc_tenant_guards.sql',
];

const SEED_FILE = 'seed_e2e_test.sql';

async function main() {
    // Try to load pg
    let pg;
    try {
        pg = require('pg');
    } catch {
        console.error('❌ pg module not found. Installing...');
        const { execSync } = await import('child_process');
        execSync('npm install pg', { cwd: join(__dirname, '..', '..', 'next-web'), stdio: 'inherit' });
        pg = require('pg');
    }

    if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_PASSWORD) {
        console.error('❌ Set DATABASE_URL or SUPABASE_DB_PASSWORD environment variable');
        console.error('   Find your DB password in Supabase Dashboard > Settings > Database');
        console.error('');
        console.error('   export SUPABASE_DB_PASSWORD="your-password"');
        console.error('   node supabase/seeds/run_migrations.mjs');
        process.exit(1);
    }

    const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected\n');

        // Check existing tables
        const { rows: existingTables } = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
      AND tablename IN (
        'fiscal_periods','warehouses','quotes','quote_items',
        'invoices','invoice_items','document_number_sequences',
        'price_lists','product_variants','margin_approvals',
        'purchase_orders','purchase_order_items','vendors',
        'payments','payment_allocations'
      )
      ORDER BY tablename;
    `);
        console.log('📋 Already existing tables:', existingTables.map(r => r.tablename).join(', ') || '(none)');
        console.log('');

        // Apply migrations
        const migrationsDir = join(__dirname, '..', 'migrations');
        let applied = 0, skipped = 0, errors = [];

        for (const filename of MIGRATIONS) {
            const filepath = join(migrationsDir, filename);

            if (!existsSync(filepath)) {
                console.log(`⏭️  SKIP (not found): ${filename}`);
                skipped++;
                continue;
            }

            const sql = readFileSync(filepath, 'utf8');
            console.log(`🔄 Applying: ${filename} (${(sql.length / 1024).toFixed(1)}KB)...`);

            try {
                await client.query(sql);
                console.log(`✅ Applied: ${filename}`);
                applied++;
            } catch (e) {
                // Check if error is just "already exists" type
                if (e.message.includes('already exists') || e.message.includes('duplicate')) {
                    console.log(`✅ Already applied: ${filename} (objects exist)`);
                    applied++;
                } else {
                    console.error(`❌ FAILED: ${filename}`);
                    console.error(`   ${e.message}`);
                    errors.push({ file: filename, error: e.message });
                }
            }
        }

        // Apply seed
        console.log('\n📦 Running seed script...');
        const seedPath = join(__dirname, SEED_FILE);
        if (existsSync(seedPath)) {
            const seedSQL = readFileSync(seedPath, 'utf8');
            try {
                await client.query(seedSQL);
                console.log(`✅ Seed applied: ${SEED_FILE}`);
            } catch (e) {
                console.error(`❌ Seed FAILED: ${e.message}`);
                errors.push({ file: SEED_FILE, error: e.message });
            }
        }

        // Verification
        console.log('\n========================================');
        console.log('  RESULTS');
        console.log('========================================');
        console.log(`Applied: ${applied}`);
        console.log(`Skipped: ${skipped}`);
        console.log(`Errors:  ${errors.length}`);

        if (errors.length > 0) {
            console.log('\nErrors:');
            for (const e of errors) {
                console.log(`  ${e.file}: ${e.error}`);
            }
        }

        // Verification queries
        console.log('\n📋 Verification...\n');

        const { rows: tables } = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
      AND tablename IN ('purchase_orders','payments','payment_allocations','vendors',
        'warehouses','invoices','document_number_sequences','quotes','quote_items',
        'price_lists','product_variants','margin_approvals')
      ORDER BY tablename;
    `);
        console.log('Tables:', tables.map(r => r.tablename).join(', '));

        const { rows: rpcs } = await client.query(`
      SELECT routine_name FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN ('issue_invoice','receive_purchase_order','post_payment',
        'void_payment','generate_document_number','create_journal_entry',
        'validate_quote_margin','approve_margin','reject_margin',
        'get_effective_price','get_product_variants')
      ORDER BY routine_name;
    `);
        console.log('RPCs:', rpcs.map(r => r.routine_name).join(', '));

        const { rows: seeds } = await client.query(`
      SELECT 'products' as entity, count(*)::text as cnt FROM products
      UNION ALL SELECT 'accounts', count(*)::text FROM chart_of_accounts
      UNION ALL SELECT 'warehouses', count(*)::text FROM warehouses
      UNION ALL SELECT 'tax_zones', count(*)::text FROM tax_zones;
    `);
        console.log('\nSeed data:');
        for (const s of seeds) {
            console.log(`  ${s.entity}: ${s.cnt}`);
        }

    } finally {
        await client.end();
        console.log('\n✅ Done!');
    }
}

main().catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
});
