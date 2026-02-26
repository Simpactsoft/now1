'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ActionResult, actionSuccess, actionError } from '@/lib/action-result';

interface RollbackResult {
    deleted: number;
}

export async function rollbackImport(jobId: string): Promise<ActionResult<RollbackResult>> {
    if (!jobId) return actionError('Job ID is required', 'VALIDATION_ERROR');

    try {
        const supabaseAuth = await createClient();
        const { data: authData } = await supabaseAuth.auth.getUser();
        if (!authData.user) return actionError('Unauthorized', 'AUTH_ERROR');

        const supabase = createAdminClient();

        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', authData.user.id)
            .single();

        if (!profile?.tenant_id) return actionError('Tenant not found', 'AUTH_ERROR');

        const tenantId = profile.tenant_id;

        // Verify the job belongs to this tenant and is in a rollback-able state
        const { data: job, error: jobError } = await supabase
            .from('import_jobs')
            .select('id, status, created_count')
            .eq('id', jobId)
            .eq('tenant_id', tenantId)
            .single();

        if (jobError || !job) return actionError('Import job not found', 'NOT_FOUND');
        if (job.status === 'rolled_back') return actionError('Import was already rolled back', 'VALIDATION_ERROR');

        // Delete all cards created by this import job
        const { data: deletedCards, error: deleteError } = await supabase
            .from('cards')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('custom_fields->>import_job_id', jobId)
            .select('id');

        if (deleteError) {
            console.error('[Rollback] Delete error:', deleteError);
            return actionError(deleteError.message, 'DB_ERROR');
        }

        const deletedCount = deletedCards?.length || 0;

        // Update job status to rolled_back
        await supabase
            .from('import_jobs')
            .update({ status: 'rolled_back' })
            .eq('id', jobId)
            .eq('tenant_id', tenantId);

        console.log(`[Rollback] Job ${jobId}: deleted ${deletedCount} cards, status -> rolled_back`);

        return actionSuccess({ deleted: deletedCount });
    } catch (e: any) {
        console.error('[Rollback] Exception:', e);
        return actionError(e.message, 'INTERNAL_ERROR');
    }
}
