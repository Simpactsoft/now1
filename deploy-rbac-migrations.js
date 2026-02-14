#!/usr/bin/env node
/**
 * RBAC Migration Deployer
 * 
 * This script deploys all RBAC migrations to Supabase Cloud
 * using the Management API and service role client.
 * 
 * Usage:
 *   node deploy-rbac-migrations.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing environment variables!');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// Create Supabase admin client (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// ============================================================================
// Migration Files (in order)
// ============================================================================

const migrations = [
    '20260212100000_rbac_user_roles.sql',
    '20260212100001_custom_access_token_hook.sql',
    '20260212100002_rbac_helpers.sql',
    '20260212100003_cpq_rls_admin_access.sql',
    '20260212100004_audit_logging.sql'
];

// ============================================================================
// Execute SQL Helper
// ============================================================================

async function executeSql(sql, migrationName) {
    console.log(`\n🔄 Running: ${migrationName}`);

    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error(`❌ Failed: ${migrationName}`);
            console.error(error);
            return false;
        }

        console.log(`✅ Success: ${migrationName}`);
        return true;
    } catch (err) {
        console.error(`❌ Exception in ${migrationName}:`, err);
        return false;
    }
}

// ============================================================================
// Alternative: Direct SQL execution via Postgres connection
// ============================================================================

async function executeDirectSql(sql) {
    // Supabase client can execute SQL directly via the REST API
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    return { data, error };
}

// ============================================================================
// Main Deployment Function
// ============================================================================

async function deployMigrations() {
    console.log('🚀 Starting RBAC Migration Deployment');
    console.log('=====================================');
    console.log(`Target: ${SUPABASE_URL}`);
    console.log(`Migrations: ${migrations.length} files`);

    let successCount = 0;
    let failCount = 0;

    for (const migrationFile of migrations) {
        const filePath = join(__dirname, 'supabase', 'migrations', migrationFile);

        try {
            const sql = readFileSync(filePath, 'utf8');
            const success = await executeSql(sql, migrationFile);

            if (success) {
                successCount++;
            } else {
                failCount++;
                console.error(`\n⚠️  Migration failed: ${migrationFile}`);
                console.error('Stopping deployment to prevent data corruption.');
                break;
            }

            // Small delay between migrations
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (err) {
            console.error(`❌ Error reading file: ${migrationFile}`);
            console.error(err);
            failCount++;
            break;
        }
    }

    console.log('\n=====================================');
    console.log('📊 Deployment Summary');
    console.log(`✅ Successful: ${successCount}/${migrations.length}`);
    console.log(`❌ Failed: ${failCount}/${migrations.length}`);

    if (failCount === 0) {
        console.log('\n🎉 All migrations deployed successfully!');
        console.log('\n📋 Next Steps:');
        console.log('1. Enable Custom Access Token Hook in Supabase Dashboard');
        console.log('   → Authentication > Hooks > Custom Access Token Hook');
        console.log('   → Select: public.custom_access_token_hook');
        console.log('2. Set your admin user (edit and run seed.sql)');
        console.log('3. Test admin access');
        return true;
    } else {
        console.log('\n⚠️  Deployment incomplete. Please check errors above.');
        return false;
    }
}

// ============================================================================
// Run
// ============================================================================

deployMigrations()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
        console.error('💥 Fatal error:', err);
        process.exit(1);
    });
