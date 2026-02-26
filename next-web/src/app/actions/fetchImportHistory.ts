'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ActionResult, actionSuccess, actionError } from '@/lib/action-result';

export interface ImportJob {
    id: string;
    status: string;
    import_type: string;
    file_name: string | null;
    duplicate_policy: string;
    total_rows: number;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    error_count: number;
    created_at: string;
    completed_at: string | null;
}

export async function fetchImportHistory(): Promise<ActionResult<ImportJob[]>> {
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

        const { data, error } = await supabase
            .from('import_jobs')
            .select('id, status, import_type, file_name, duplicate_policy, total_rows, created_count, updated_count, skipped_count, error_count, created_at, completed_at')
            .eq('tenant_id', profile.tenant_id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) return actionError(error.message, 'DB_ERROR');

        return actionSuccess(data || []);
    } catch (e: any) {
        return actionError(e.message, 'INTERNAL_ERROR');
    }
}
