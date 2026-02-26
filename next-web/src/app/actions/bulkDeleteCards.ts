'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Bulk deletes cards by IDs, with tenant security check.
 */
export async function bulkDeleteCards(ids: string[]): Promise<{ success: boolean; deleted: number; error?: string }> {
    if (!ids || ids.length === 0) {
        return { success: false, deleted: 0, error: 'No IDs provided' };
    }

    if (ids.length > 200) {
        return { success: false, deleted: 0, error: 'Maximum 200 items can be deleted at once' };
    }

    try {
        // Auth check
        const supabaseAuth = await createClient();
        const { data: authData } = await supabaseAuth.auth.getUser();
        if (!authData.user) {
            return { success: false, deleted: 0, error: 'Unauthorized' };
        }

        const supabase = createAdminClient(supabaseUrl, supabaseServiceKey);

        // Get tenant
        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', authData.user.id)
            .single();

        if (!profile?.tenant_id) {
            return { success: false, deleted: 0, error: 'Tenant not found' };
        }

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
            return { success: false, deleted: 0, error: error.message };
        }

        const deletedCount = data?.length || 0;
        console.log(`[BulkDelete] Deleted ${deletedCount} cards for tenant ${tenantId}`);

        return { success: true, deleted: deletedCount };
    } catch (e: any) {
        console.error('[BulkDelete] Exception:', e);
        return { success: false, deleted: 0, error: e.message || 'Unknown error' };
    }
}
