import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function runCleanup() {
    console.log('🧹 Starting Deep Cleanup Protocol...');
    console.log('TARGET: Removing legacy identities without memberships.');

    let totalDeleted = 0;
    let batchSize = 5000; // Conservative batch size for stability
    let iteration = 0;
    let isFinished = false;

    while (!isFinished) {
        iteration++;
        const startTime = Date.now();

        try {
            const { data, error } = await supabase.rpc('cleanup_legacy_party_batch', {
                arg_batch_size: batchSize
            });

            if (error) {
                console.error(`❌ Error in batch ${iteration}:`, error.message);
                // Backoff and retry with smaller batch
                if (batchSize > 1000) {
                    batchSize = Math.floor(batchSize / 2);
                    console.log(`⚠️ Reducing batch size to ${batchSize}`);
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                } else {
                    throw error;
                }
            }

            const deletedCount = data as number;
            totalDeleted += deletedCount;
            const duration = Date.now() - startTime;

            if (deletedCount > 0) {
                process.stdout.write(`\r✅ Batch ${iteration}: Deleted ${deletedCount} records (${duration}ms). Total: ${totalDeleted}`);
            } else {
                console.log('\n✨ Cleanup Complete! No more legacy records found.');
                isFinished = true;
            }

        } catch (err) {
            console.error('\n💥 Critical Failure:', err);
            process.exit(1);
        }
    }

    console.log(`\n🎉 SUMMARY: Successfully removed ${totalDeleted} legacy records.`);
}

runCleanup();
