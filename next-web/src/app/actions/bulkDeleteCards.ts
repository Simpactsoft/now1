'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ActionResult, actionSuccess, actionError } from '@/lib/action-result';

interface BulkDeleteResult {
    deleted: number;
}

/**
 * Bulk deletes cards by IDs, with tenant security check.
 */
export async function bulkDeleteCards(ids: string[]): Promise<ActionResult<BulkDeleteResult>> {
    if (!ids || ids.length === 0) return actionError('No IDs provided', 'VALIDATION_ERROR');
    if (ids.length > 200) return actionError('Maximum 200 items can be deleted at once', 'VALIDATION_ERROR');

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

        // Delete cards that belong to this tenant only
        const { data, error } = await supabase
            .from('cards')
            .delete()
            .in('id', ids)
            .eq('tenant_id', tenantId)
            .select('id');

        if (error) {
            console.error('[BulkDelete] Error:', error);
            return actionError(error.message, 'DB_ERROR');
        }

        const deletedCount = data?.length || 0;
        console.log(`[BulkDelete] Deleted ${deletedCount} cards for tenant ${tenantId}`);

        return actionSuccess({ deleted: deletedCount });
    } catch (e: any) {
        console.error('[BulkDelete] Exception:', e);
        return actionError(e.message, 'INTERNAL_ERROR');
    }
}
