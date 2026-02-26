'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function rollbackImport(jobId: string): Promise<{ success: boolean; deleted: number; error?: string }> {
    if (!jobId) return { success: false, deleted: 0, error: 'Job ID is required' };

    try {
        const supabaseAuth = await createClient();
        const { data: authData } = await supabaseAuth.auth.getUser();
        if (!authData.user) return { success: false, deleted: 0, error: 'Unauthorized' };

        const supabase = createAdminClient(supabaseUrl, supabaseServiceKey);

        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', authData.user.id)
            .single();

        if (!profile?.tenant_id) return { success: false, deleted: 0, error: 'Tenant not found' };

        const tenantId = profile.tenant_id;

        // Verify the job belongs to this tenant and is in a rollback-able state
        const { data: job, error: jobError } = await supabase
            .from('import_jobs')
            .select('id, status, created_count')
            .eq('id', jobId)
            .eq('tenant_id', tenantId)
            .single();

        if (jobError || !job) return { success: false, deleted: 0, error: 'Import job not found' };
        if (job.status === 'rolled_back') return { success: false, deleted: 0, error: 'Import was already rolled back' };

        // Delete all cards created by this import job
        const { data: deletedCards, error: deleteError } = await supabase
            .from('cards')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('custom_fields->>import_job_id', jobId)
            .select('id');

        if (deleteError) {
            console.error('[Rollback] Delete error:', deleteError);
            return { success: false, deleted: 0, error: deleteError.message };
        }

        const deletedCount = deletedCards?.length || 0;

        // Update job status to rolled_back
        await supabase
            .from('import_jobs')
            .update({ status: 'rolled_back' })
            .eq('id', jobId)
            .eq('tenant_id', tenantId);

        console.log(`[Rollback] Job ${jobId}: deleted ${deletedCount} cards, status -> rolled_back`);

        return { success: true, deleted: deletedCount };
    } catch (e: any) {
        console.error('[Rollback] Exception:', e);
        return { success: false, deleted: 0, error: e.message };
    }
}
